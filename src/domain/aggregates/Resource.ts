/* 
family
name
description
*/

import { ErrorFactory } from "../../utils/errors/Error.map";
import { REGEXP } from "../../utils/Regexp";
import { Uuid } from "./User";

export type ResourceProps = {
  id: Uuid;
  familyId: Uuid;
  name: ResourceName;
  description: ResourceDescription;
};

export type ResourceCreateProps = {
  id?: string;
  familyId: string;
  name: string;
  description: string;
};

export type ResourceDTO = {
  id: string;
  family_id: string;
  name: string;
  description: string;
};

export class ResourceName {
  private constructor(private readonly value: string) {}

  static create(value: string): ResourceName {
    const normalized = value.trim();
    if (!REGEXP.resourceName.test(normalized)) {
      throw ErrorFactory.domain("DOMAIN.INVALID_RESOURCE_NAME", {
        name: value,
      });
    }

    return new ResourceName(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ResourceName): boolean {
    return this.value === other.value;
  }
}

export class ResourceDescription {
  private constructor(private readonly value: string) {}

  static create(value: string): ResourceDescription {
    const normalized = value.trim();
    if (!REGEXP.resourceDescription.test(normalized)) {
      throw ErrorFactory.domain("DOMAIN.INVALID_RESOURCE_DESCRIPTION");
    }

    return new ResourceDescription(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ResourceDescription): boolean {
    return this.value === other.value;
  }
}

export class Resource {
  private props: ResourceProps;

  private constructor(props: ResourceProps) {
    this.props = { ...props };
  }
}
