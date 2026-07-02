"use client";

import { useState, useEffect, useCallback } from "react";

type UseEntityFormOptions<TInput, TEntity> = {
  /** Default values for a blank form */
  defaults: TInput;
  /** Entity being edited (undefined = create mode) */
  initialEntity?: TEntity;
  /** Map an existing entity to form field values */
  entityToInput: (entity: TEntity) => TInput;
  /** API call: create a new entity */
  onCreate: (input: TInput) => Promise<unknown>;
  /** API call: update an existing entity */
  onUpdate: (id: string, input: TInput) => Promise<unknown>;
  /** Get the entity's ID from the entity object */
  getId: (entity: TEntity) => string;
  /** Called after successful create or update */
  onSuccess?: () => void;
};

export function useEntityForm<TInput, TEntity>({
  defaults,
  initialEntity,
  entityToInput,
  onCreate,
  onUpdate,
  getId,
  onSuccess,
}: UseEntityFormOptions<TInput, TEntity>) {
  const isEditMode = !!initialEntity;
  const [fields, setFields] = useState<TInput>(defaults);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate fields when editing an existing entity
  useEffect(() => {
    if (initialEntity) {
      setFields(entityToInput(initialEntity));
      setError(null);
    }
  }, [initialEntity, entityToInput]);

  const resetForm = useCallback(() => {
    setFields(defaults);
    setError(null);
  }, [defaults]);

  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    try {
      setIsSubmitting(true);
      if (isEditMode && initialEntity) {
        await onUpdate(getId(initialEntity), fields);
      } else {
        await onCreate(fields);
        resetForm();
      }
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditMode ? "Failed to update" : "Failed to create"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [fields, isEditMode, initialEntity, onCreate, onUpdate, getId, onSuccess, resetForm]);

  return {
    fields,
    setFields,
    isEditMode,
    isSubmitting,
    error,
    setError,
    handleSubmit,
    handleCancel,
    resetForm,
  };
}
