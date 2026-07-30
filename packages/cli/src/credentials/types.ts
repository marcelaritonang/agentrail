export interface CredentialStore {
  get(projectKey: string): Promise<string | null>;
  set(projectKey: string, credential: string): Promise<void>;
  delete(projectKey: string): Promise<void>;
  kind: "platform" | "restricted-file";
}

export type DeviceCodeRequest = {
  schema_version: 1;
  client_type: "codex" | "claude";
  package_version: string;
};

export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
  request_id?: string;
};

export type DeviceTokenResponse =
  | {
      status: "authorization_pending";
      interval?: number;
      request_id?: string;
    }
  | {
      status: "slow_down";
      interval?: number;
      request_id?: string;
    }
  | {
      status: "expired_token";
      request_id?: string;
    }
  | {
      status: "access_denied";
      request_id?: string;
    }
  | {
      status: "approved";
      project_id: string;
      installation_id: string;
      credential: string;
      request_id?: string;
    };

export type DeviceApi = {
  issue(input: DeviceCodeRequest): Promise<DeviceCodeResponse>;
  poll(deviceCode: string): Promise<DeviceTokenResponse>;
};

export type CredentialStoreCheck = {
  ok: boolean;
  warnings: readonly { code: string; detail: string }[];
  failures: readonly { code: string; detail: string }[];
};
