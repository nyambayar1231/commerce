// Adapted from saleor-dashboard: src/auth/index.tsx and src/auth/views/Login.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// What a signed-out visitor sees, at whatever URL they opened (Saleor's catch-all LoginView):
// after login the app renders that same URL. Password reset routes come with M8.

import { useUser } from "./AuthProvider";
import { Layout } from "./components/Layout";
import { LoginPage } from "./components/LoginPage/LoginPage";

export const Auth = () => {
  const { login, loggingIn, errors } = useUser();

  return (
    <Layout>
      <LoginPage
        errors={errors}
        disabled={loggingIn}
        loading={loggingIn}
        onSubmit={({ email, password }) => void login(email, password)}
      />
    </Layout>
  );
};
