import type { OpenClawConfig } from "openclaw/plugin-sdk/config-types";
import { resolveLivePluginConfigObject } from "openclaw/plugin-sdk/plugin-config-runtime";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { formatShadowObservation, inspectOutboundText } from "./src/shadow.js";

type WatermarkRemoverConfig = {
  enabled?: boolean;
  channels?: string[];
};

function resolveConfig(raw: Record<string, unknown>): WatermarkRemoverConfig {
  return {
    enabled: raw.enabled !== false,
    channels: Array.isArray(raw.channels)
      ? raw.channels.filter((value): value is string => typeof value === "string")
      : ["discord"],
  };
}

export default definePluginEntry({
  id: "watermark-remover",
  name: "Watermark Remover",
  description: "Shadow-mode inspection of outbound text for suspicious Unicode controls.",
  register(api) {
    const resolveCurrentConfig = () =>
      resolveConfig(
        resolveLivePluginConfigObject(
          api.runtime.config?.current
            ? () => api.runtime.config.current() as OpenClawConfig
            : undefined,
          "watermark-remover",
          api.pluginConfig as Record<string, unknown>,
        ),
      );

    api.on("message_sending", (event, ctx) => {
      const report = inspectOutboundText({
        content: event.content,
        channelId: ctx.channelId,
        ...resolveCurrentConfig(),
      });
      const observation = report ? formatShadowObservation(report) : undefined;
      if (observation) {
        api.logger.info(observation);
      }
      // Shadow mode must never return content: delivery remains byte-for-byte untouched.
      return undefined;
    });
  },
});
