/// <reference types="expo/types" />

// NOTE: This file should not be edited and should be in your git ignore
declare module "*.svg" {
  import React from "react";
  import { SvgProps } from "react-native-svg";
  const content: React.FC<SvgProps>;
  export default content;
}
