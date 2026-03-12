import { z } from "zod";
import invalidBody from "../../utils/invalidBody";
import errorHandler from "../../utils/errors/Errors.handler";
import { ErrorFactory } from "../../utils/errors/Error.map";

type MockResponse = {
  locals: Record<string, unknown>;
  status: jest.Mock;
  json: jest.Mock;
};

function createResponse(): MockResponse {
  const response = {
    locals: {},
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as MockResponse;

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

describe("error responses", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns explicit validation messages for invalid request bodies", () => {
    const response = createResponse();
    const schema = z.object({
      email: z.email(),
    });
    const parsed = schema.safeParse({ email: "not-an-email" });

    expect(parsed.success).toBe(false);
    invalidBody(response as never, parsed.error);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      error: "INVALID_BODY",
      message: 'Invalid "email": Invalid email address',
      details: [
        {
          field: "email",
          message: "Invalid email address",
          code: "invalid_format",
        },
      ],
    });
  });

  it("returns public messages without logging them", () => {
    const response = createResponse();
    const error = ErrorFactory.domain("DOMAIN.INVALID_USER_EMAIL", {
      email: "bad-email",
    });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(error, response as never);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      error: "DOMAIN.INVALID_USER_EMAIL",
      message: 'Invalid email address "bad-email".',
    });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("logs hidden infrastructure errors and returns a generic payload", () => {
    const response = createResponse();
    const error = ErrorFactory.infra("INFRA.TRANSACTION_FAILED", {
      cause: "duplicate key value violates unique constraint",
    });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(error, response as never);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      error: "INTERNAL_ERROR",
      message: "Something went wrong.",
    });
    expect(consoleSpy).toHaveBeenCalled();
  });
});
