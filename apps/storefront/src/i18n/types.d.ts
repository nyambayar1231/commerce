import type mn from "../../messages/mn.json";

// Message keys are type-checked against messages/mn.json.
declare module "next-intl" {
  interface AppConfig {
    Locale: "mn";
    Messages: typeof mn;
  }
}
