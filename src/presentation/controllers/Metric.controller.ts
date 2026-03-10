import { Request, Response } from "express";
import { TrackMetric } from "../../app/use-cases/commands/metrics/TrackMetric.command";
import { FindMetric } from "../../app/use-cases/queries/metrics/FindMetric.query";
import { ListMetrics } from "../../app/use-cases/queries/metrics/ListMetrics.query";
import { MetricsDashboardQuery } from "../../app/use-cases/queries/metrics/MetricsDashboard.query";
import { TrafficAnalyticsQueryService } from "../../app/use-cases/queries/metrics/TrafficAnalytics.query";
import { TrafficAnalyticsQuery } from "../../app/interfaces/Metric.port";
import { TrackMetricDTO } from "../security/metrics/TrackMetric.dto";
import { FindMetricByIdDTO } from "../security/metrics/FindMetricById.dto";
import { ListMetricsDTO } from "../security/metrics/ListMetrics.dto";
import { MetricsDashboardDTO } from "../security/metrics/MetricsDashboard.dto";
import { TrafficAnalyticsDTO } from "../security/metrics/TrafficAnalytics.dto";
import errorHandler from "../../utils/errors/Errors.handler";
import invalidBody from "../../utils/invalidBody";
import { presentMetric, presentMetricAdmin } from "../presenters/Aggregate.presenter";

export class MetricController {
  constructor(
    private readonly trackMetric: TrackMetric,
    private readonly findMetric: FindMetric,
    private readonly listMetrics: ListMetrics,
    private readonly dashboardMetrics: MetricsDashboardQuery,
    private readonly trafficAnalytics: TrafficAnalyticsQueryService,
  ) {}

  private wantsDashboardView(req: Request): boolean {
    return req.auth.userRole === "Admin" && req.query.view === "dashboard";
  }

  public track = async (req: Request, res: Response) => {
    try {
      const parsed = TrackMetricDTO.safeParse(req.body);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const metric = await this.trackMetric.execute(parsed.data);
      if (this.wantsDashboardView(req)) {
        return res.status(201).json(presentMetricAdmin(metric));
      }
      return res.status(201).json(presentMetric(metric));
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public findById = async (req: Request, res: Response) => {
    try {
      const parsed = FindMetricByIdDTO.safeParse(req.params);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const metric = await this.findMetric.byId(parsed.data.id);
      if (!metric) return res.status(200).json(null);
      if (this.wantsDashboardView(req)) {
        return res.status(200).json(presentMetricAdmin(metric));
      }
      return res.status(200).json(presentMetric(metric));
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public list = async (req: Request, res: Response) => {
    try {
      const parsed = ListMetricsDTO.safeParse(req.query);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const result = await this.listMetrics.execute(parsed.data);
      const mapMetric = this.wantsDashboardView(req) ? presentMetricAdmin : presentMetric;
      return res.status(200).json({
        rows: result.rows.map((row) => mapMetric(row)),
        total: result.total,
      });
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public dashboard = async (req: Request, res: Response) => {
    try {
      const parsed = MetricsDashboardDTO.safeParse(req.query);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const result = await this.dashboardMetrics.execute(parsed.data);
      return res.status(200).json(result);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };

  public traffic = async (req: Request, res: Response) => {
    try {
      const parsed = TrafficAnalyticsDTO.safeParse(req.query);
      if (!parsed.success) return invalidBody(res, parsed.error);
      const query: TrafficAnalyticsQuery = {
        from: parsed.data.from,
        to: parsed.data.to,
        limitRecent: parsed.data.limitRecent,
        limitRoutes: parsed.data.limitRoutes,
        limitReferrers: parsed.data.limitReferrers,
      };
      const result = await this.trafficAnalytics.execute(query);
      return res.status(200).json(result);
    } catch (err: unknown) {
      return errorHandler(err, res);
    }
  };
}
