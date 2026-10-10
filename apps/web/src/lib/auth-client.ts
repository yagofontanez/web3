"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient, siweClient } from "better-auth/client/plugins";
import { ac, roles } from "@w3s/shared/permissions";

export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles }), siweClient()],
});
