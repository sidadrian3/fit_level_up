import { MongoServerError, ObjectId } from "mongodb";

const DUPLICATE_KEY_CODE = 11000;

export function parseObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export function isDuplicateKeyError(error: unknown, field: string): boolean {
  return (
    error instanceof MongoServerError &&
    error.code === DUPLICATE_KEY_CODE &&
    field in (error.keyPattern ?? {})
  );
}
