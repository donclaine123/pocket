import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./widgets/widget-task-handler";
import "expo-router/entry";

// Register the Android background widget task handler
registerWidgetTaskHandler(widgetTaskHandler);
