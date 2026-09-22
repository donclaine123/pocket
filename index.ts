import { Platform } from "react-native";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./widgets/widget-task-handler";
import "expo-router/entry";

// Register the Android background widget task handler only on Android
if (Platform.OS === "android") {
  registerWidgetTaskHandler(widgetTaskHandler);
}

