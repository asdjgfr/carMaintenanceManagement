import { Provider } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { ConfigProvider } from "antd";
import "./index.less";
import App from "./App";
import * as serviceWorker from "./serviceWorker";
import zhCN from "antd/es/locale/zh_CN";
import "dayjs/locale/zh-cn";

import Store from "@/store";

const store = {
  store: new Store(),
};

ReactDOM.render(
  <Provider {...store}>
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>
  </Provider>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
