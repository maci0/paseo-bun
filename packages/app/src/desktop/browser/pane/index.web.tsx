import { createElement, useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { ExternalLink, RotateCw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { EditingTextInput as TextInput } from "@/components/ui/text-input";
import { ToolbarButton } from "@/components/ui/pane-content-toolbar";
import { normalizeWorkspaceBrowserUrl, useBrowserStore } from "@/desktop/browser/store";
import { isLoopbackHttpUrl } from "@/desktop/browser/loopback-url";
import { WORKSPACE_SECONDARY_HEADER_HEIGHT } from "@/constants/layout";
import { openExternalUrl } from "@/utils/open-external-url";

interface BrowserPaneProps {
  browserId: string;
  serverId: string;
  workspaceId: string;
  cwd: string | null;
  isInteractive?: boolean;
  onFocusPane?: () => void;
}

// No allow-top-navigation: the framed page must never replace the app.
const FRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads";

const FRAME_STYLE = { flex: 1, width: "100%", height: "100%", border: 0, background: "white" };

// ponytail: cross-origin frames hide their history and current URL, so there is
// no back/forward and Refresh reloads the URL from the bar. The Electron pane
// (index.electron.tsx) has the full browser.
export function BrowserPane({ browserId }: BrowserPaneProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const url = useBrowserStore((state) => state.browsersById[browserId]?.url ?? "");
  const updateBrowser = useBrowserStore((state) => state.updateBrowser);
  const canFrame = isLoopbackHttpUrl(url);
  const [draftUrl, setDraftUrl] = useState(canFrame ? url : "");
  const [reloadCount, setReloadCount] = useState(0);

  const navigate = useCallback(() => {
    if (draftUrl.trim().length === 0) return;
    const next = normalizeWorkspaceBrowserUrl(draftUrl);
    if (isLoopbackHttpUrl(next)) {
      updateBrowser(browserId, { url: next, title: next, lastError: null });
      setReloadCount((count) => count + 1);
      return;
    }
    void openExternalUrl(next);
  }, [browserId, draftUrl, updateBrowser]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const openExternally = useCallback(() => void openExternalUrl(url), [url]);

  const iconColor = theme.colors.foregroundMuted;
  const urlInputStyle = useMemo(
    () => [styles.urlInput, { color: theme.colors.foreground, outlineStyle: "none" } as object],
    [theme.colors.foreground],
  );
  const hintStyle = useMemo(() => [styles.hint, { color: iconColor }], [iconColor]);

  return (
    <View style={styles.container}>
      <View style={styles.chromeRow}>
        <ToolbarButton
          label={t("workspace.browser.controls.refresh")}
          disabled={!canFrame}
          onPress={reload}
        >
          <RotateCw size={16} color={iconColor} />
        </ToolbarButton>
        <View style={styles.urlBarWrap}>
          <TextInput
            accessibilityLabel={t("workspace.browser.controls.browserUrl")}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setDraftUrl}
            onSubmitEditing={navigate}
            placeholder={t("workspace.browser.controls.enterUrl")}
            placeholderTextColor={iconColor}
            style={urlInputStyle}
            initialValue={canFrame ? url : ""}
          />
        </View>
        <ToolbarButton
          label={t("serviceUrl.externalBrowser")}
          disabled={!canFrame}
          onPress={openExternally}
        >
          <ExternalLink size={16} color={iconColor} />
        </ToolbarButton>
      </View>
      {canFrame ? (
        createElement("iframe", {
          key: reloadCount,
          src: url,
          title: url,
          sandbox: FRAME_SANDBOX,
          style: FRAME_STYLE,
        })
      ) : (
        <View style={styles.emptyState}>
          <Text style={hintStyle}>{t("workspace.browser.localOnly")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.colors.surface0,
  },
  chromeRow: {
    height: WORKSPACE_SECONDARY_HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  urlBarWrap: {
    flex: 1,
    minWidth: 0,
    height: 28,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing[2],
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface1,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  urlInput: {
    flex: 1,
    minWidth: 0,
    fontSize: theme.fontSize.base,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing[4],
  },
  hint: {
    fontSize: theme.fontSize.sm,
    textAlign: "center",
  },
}));
