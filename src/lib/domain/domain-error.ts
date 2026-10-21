export type DomainErrorKind = "invalid" | "conflict";

export class DomainError extends Error {
  constructor(public readonly kind: DomainErrorKind, message: string) {
    super(message);
    this.name = "DomainError";
  }
}
