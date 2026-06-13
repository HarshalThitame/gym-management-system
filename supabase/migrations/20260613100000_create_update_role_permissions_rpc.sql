CREATE OR REPLACE FUNCTION update_role_permissions(
  p_role_id UUID,
  p_permissions JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  perm JSONB;
BEGIN
  DELETE FROM role_permissions WHERE role_id = p_role_id;

  IF jsonb_array_length(p_permissions) > 0 THEN
    FOR perm IN SELECT * FROM jsonb_array_elements(p_permissions)
    LOOP
      INSERT INTO role_permissions (role_id, resource, actions)
      VALUES (
        p_role_id,
        perm->>'resource',
        ARRAY(SELECT jsonb_array_elements_text(perm->'actions'))
      );
    END LOOP;
  END IF;
END;
$$;
