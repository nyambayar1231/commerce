// Adapted from saleor-dashboard: src/auth/components/LoginPage/LoginPage.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Password login only: Saleor's external (OIDC) buttons, last-login indicator and
// "password login disabled" state are left out. "Forgot password?" waits for password reset
// (M8, needs outgoing email). Saleor's ButtonWithLoader becomes a Button that is disabled with a
// Spinner while the request runs.
import { Box, Button, Input, Spinner, Text } from "@saleor/macaw-ui";
import { Eye } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { commonMessages } from "../../../intl";
import type { UserContextError } from "../../AuthProvider";
import { getErrorMessage } from "./messages";

interface LoginPageProps {
  errors: UserContextError[];
  disabled: boolean;
  loading: boolean;
  onSubmit: (data: { email: string; password: string }) => void;
}

export const LoginPage = ({ errors, disabled, loading, onSubmit }: LoginPageProps) => {
  const intl = useIntl();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box display="flex" flexDirection="column" alignItems="flex-start" width="100%">
        <Text size={6} fontWeight="bold" lineHeight={3} marginBottom={4}>
          <FormattedMessage id="vzgZ3U" defaultMessage="Sign In" description="card header" />
        </Text>
        {errors.map((error) => (
          <Box
            borderRadius={4}
            padding={4}
            backgroundColor="critical1"
            width="100%"
            marginBottom={2}
            key={error}
            data-test-id="login-error-message"
          >
            <Text color="critical2">{getErrorMessage(error, intl)}</Text>
          </Box>
        ))}
        <Input
          autoFocus
          width="100%"
          autoComplete="email"
          label={intl.formatMessage(commonMessages.email)}
          id="email"
          name="email"
          type="email"
          onChange={(event) => setEmail(event.target.value)}
          value={email}
          data-test-id="email"
          spellCheck={false}
          disabled={disabled}
          required
        />
        {/* Saleor's FormSpacer: theme.spacing(3) = 24px. */}
        <Box marginTop={6} width="100%">
          <Input
            width="100%"
            label={intl.formatMessage({ id: "5sg7KC", defaultMessage: "Password" })}
            id="password"
            name="password"
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? "text" : "password"}
            value={password}
            data-test-id="password"
            spellCheck={false}
            disabled={disabled}
            endAdornment={
              <Button
                icon={<Eye size={20} />}
                onMouseDown={() => setShowPassword(true)}
                onMouseUp={() => setShowPassword(false)}
                onMouseLeave={() => setShowPassword(false)}
                variant="tertiary"
                type="button"
                aria-label={intl.formatMessage({ id: "JHTwdB", defaultMessage: "Show password" })}
              />
            }
            required
          />
        </Box>
        <Box display="flex" justifyContent="flex-end" width="100%" marginTop={6}>
          <Button
            width="100%"
            disabled={disabled}
            variant="primary"
            type="submit"
            data-test-id="submit"
          >
            {loading ? (
              <Spinner />
            ) : (
              <FormattedMessage id="AubJ/S" defaultMessage="Sign in" description="button" />
            )}
          </Button>
        </Box>
      </Box>
    </form>
  );
};
