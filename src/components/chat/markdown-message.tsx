import Markdown from "react-native-markdown-display";

import { Fonts } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type MarkdownMessageProps = {
  children: string;
  inverse?: boolean;
};

export function MarkdownMessage({ children, inverse }: MarkdownMessageProps) {
  const theme = useTheme();
  const textColor = inverse ? "#ffffff" : theme.text;
  const subtleColor = inverse ? "rgba(255, 255, 255, 0.72)" : theme.textSecondary;
  const borderColor = inverse ? "rgba(255, 255, 255, 0.22)" : theme.backgroundSelected;

  return (
    <Markdown
      style={{
        body: {
          color: textColor,
          fontSize: 16,
          lineHeight: 23,
          fontWeight: "500",
        },
        heading1: {
          color: textColor,
          fontSize: 24,
          lineHeight: 30,
          fontWeight: "700",
          marginTop: 0,
          marginBottom: 8,
        },
        heading2: {
          color: textColor,
          fontSize: 20,
          lineHeight: 26,
          fontWeight: "700",
          marginTop: 0,
          marginBottom: 8,
        },
        paragraph: {
          marginTop: 0,
          marginBottom: 10,
        },
        bullet_list: {
          marginBottom: 10,
        },
        ordered_list: {
          marginBottom: 10,
        },
        blockquote: {
          borderLeftColor: borderColor,
          borderLeftWidth: 3,
          paddingLeft: 10,
          color: subtleColor,
        },
        code_inline: {
          color: textColor,
          backgroundColor: inverse
            ? "rgba(255, 255, 255, 0.14)"
            : theme.backgroundElement,
          borderRadius: 6,
          fontFamily: Fonts.mono,
          fontSize: 14,
          paddingHorizontal: 4,
          paddingVertical: 2,
        },
        fence: {
          color: textColor,
          backgroundColor: inverse
            ? "rgba(255, 255, 255, 0.12)"
            : theme.backgroundElement,
          borderRadius: 8,
          fontFamily: Fonts.mono,
          fontSize: 13,
          lineHeight: 19,
          padding: 10,
        },
        table: {
          borderColor,
          borderWidth: 1,
          borderRadius: 8,
        },
        th: {
          borderColor,
          backgroundColor: inverse
            ? "rgba(255, 255, 255, 0.12)"
            : theme.backgroundElement,
        },
        tr: {
          borderColor,
        },
        td: {
          borderColor,
        },
        link: {
          color: inverse ? "#ffffff" : "#2d6cdf",
          textDecorationLine: "underline",
        },
      }}>
      {children}
    </Markdown>
  );
}
