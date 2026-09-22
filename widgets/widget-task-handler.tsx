import React from "react";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import {
  Balance2x1Widget,
  Banner4x1Widget,
  Dashboard4x2Widget,
  FullJournal4x4Widget,
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

  // 1. Handle Background 1-Tap Preset Clicks (e.g. +$5 Coffee, +$15 Meal, +$25 Groceries)
  if (widgetAction === "WIDGET_CLICK" && clickAction === "ADD_PRESET") {
    const amount = Number(clickActionData?.amount) || 5;
    const category = String(clickActionData?.category || "food_beverage");
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
    case "Banner4x1":
      renderWidget(<Banner4x1Widget {...data} />);
      break;
    case "Dashboard4x2":
      renderWidget(<Dashboard4x2Widget {...data} />);
      break;
    case "FullJournal4x4":
      renderWidget(<FullJournal4x4Widget {...data} />);
      break;
    case "Glance2x2":
    default:
      renderWidget(<Glance2x2Widget {...data} />);
      break;
  }
}
