type GcpErrorData = {
  code: number,
  message: string,
  status: string,
};

export class GoogleCloudError extends Error {
  private readonly _errData: GcpErrorData;

  constructor(errData: GcpErrorData) {
    super(`E_${errData.status} (code ${errData.code}): ${errData.message}`);
    this.name = "GoogleCloudError";
    Object.setPrototypeOf(this, GoogleCloudError.prototype);

    this._errData = errData;
  }

  get code(): number {
    return this._errData.code;
  }
  get data(): GcpErrorData {
    return this._errData;
  }
  get innerMessage(): string {
    return this._errData.message;
  }
  get status(): string {
    return this._errData.status;
  }
}
