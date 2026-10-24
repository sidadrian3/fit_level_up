"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isIdempotencyKeyReused } from "@/lib/data/api-client";
import { useIdempotencyKey } from "./useIdempotencyKey";

type UseEntityFormOptions<TInput, TEntity> = {
  /** Default values for a blank form */
  defaults: TInput;
  /** Entity being edited (undefined = create mode) */
  initialEntity?: TEntity;
  /** Map an existing entity to form field values */
  entityToInput: (entity: TEntity) => TInput;
  /** API call: create a new entity */
  onCreate: (input: TInput, idempotencyKey: string) => Promise<unknown>;
  /** API call: update an existing entity */
  onUpdate: (id: string, input: TInput) => Promise<unknown>;
  /** Get the entity's ID from the entity object */
  getId: (entity: TEntity) => string;
  /** Called after successful create or update */
  onSuccess?: () => void;
  /** Called when the server reports this create was already saved under a different body */
  onAlreadySaved?: () => void;
};

export function useEntityForm<TInput, TEntity>({
  defaults,
  initialEntity,
  entityToInput,
  onCreate,
  onUpdate,
  getId,
  onSuccess,
  onAlreadySaved,
}: UseEntityFormOptions<TInput, TEntity>) {
  const queryClient = useQueryClient();
  const { key: idempotencyKey, rotate: rotateIdempotencyKey } = useIdempotencyKey();
  const isEditMode = !!initialEntity;
  const [fields, setFields] = useState<TInput>(defaults);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate fields when editing an existing entity
  useEffect(() => {
    if (initialEntity) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFields(entityToInput(initialEntity));
      setError(null);
    }
    // Explicitly exclude entityToInput so we only overwrite state when the actual entity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEntity]);

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
        await onCreate(fields, idempotencyKey);
        rotateIdempotencyKey();
        resetForm();
      }
      
      // Invalidate the user cache to trigger a global refresh of XP/Stamina
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      
      onSuccess?.();
    } catch (err) {
      if (!isEditMode && isIdempotencyKeyReused(err)) {
        rotateIdempotencyKey();
        await queryClient.invalidateQueries({ queryKey: ["user"] });
        onAlreadySaved?.();
      }
      setError(
        err instanceof Error
          ? err.message
          : isEditMode ? "Failed to update" : "Failed to create"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [fields, isEditMode, initialEntity, onCreate, onUpdate, getId, onSuccess, onAlreadySaved, resetForm, idempotencyKey, rotateIdempotencyKey, queryClient]);

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
