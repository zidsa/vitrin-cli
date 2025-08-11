# Vitrin CLI Configuration

## Environment Variables

You can configure the Vitrin CLI using the following environment variables:

### Debug Configuration

- **`LOG_LEVEL`**: Set the logging level
  - Options: `debug`, `info`, `warn`, `error`
  - Default: `info`
  - Example: `LOG_LEVEL=debug vitrin preview 123`

## For Internal Development Only

The following environment variables are for internal Zid development only and should not be used in production:

- `VITRIN_API_URL`: Override API endpoint
- `VITRIN_PARTNER_URL`: Override partner dashboard URL

These variables are not documented publicly and are subject to change.