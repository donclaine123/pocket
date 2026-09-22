import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import {
  Balance2x1Widget,
  Glance2x2Widget,
  QuickAdd1x1Widget,
  WidgetDataProps,
} from "./PocketWidgets";
import {
  getStoredWidgetData,
  logPresetTransactionFromWidget,
} from "../services/widgetSync";

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo, widgetAction, clickAction, clickActionData, renderWidget } = props;

  let data: WidgetDataProps = await getStoredWidgetData();

  // 1. Handle Background 1-Tap Preset Clicks (e.g. +$5 Coffee, +$15 Meal)
  if (widgetAction === "WIDGET_CLICK" && clickAction === "ADD_PRESET") {
    const amount = Number(clickActionData?.amount) || 5;
    const category = String(clickActionData?.category || "Food & Dining");
    const note = String(clickActionData?.note || "Quick Log");

    // Write directly in background without opening app
    data = await logPresetTransactionFromWidget(amount, category, note);
  }

  // 2. Render appropriate widget layout
  switch (widgetInfo.widgetName) {
    case "QuickAdd1x1":
      renderWidget(<QuickAdd1x1Widget {...data} />);
      break;
    case "Balance2x1":
      renderWidget(<Balance2x1Widget {...data} />);
      break;
    case "Glance2x2":
    default:
      renderWidget(<Glance2x2Widget {...data} />);
      break;
  }
}
