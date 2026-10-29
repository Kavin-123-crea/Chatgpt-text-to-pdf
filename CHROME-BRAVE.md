# Chrome and Brave builds

Chrome and Brave use the same Chromium extension format as Edge, so the verified extension is copied into browser-specific folders:

- `chrome/`
- `brave/`

To rebuild both folders from the working Edge extension:

```sh
node build-chromium-extensions.js
```

To install either build, open the browser's extensions page, enable Developer mode, choose **Load unpacked**, and select the matching folder.
