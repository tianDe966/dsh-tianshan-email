window.__ModuleLoader__.load({
  id: "dsh-tianshan-email",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.js
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/SettingsCard.jsx
var import_react = __toESM(require("react"), 1);

// src/client/scope.js
var API = {
  describe: "/api/dsh-tianshan-email/settings/describe",
  mutate: "/api/dsh-tianshan-email/settings/mutate",
  test: "/api/dsh-tianshan-email/test"
};
var NS = "tianshan-email";
function createSettingsScope() {
  let snapshot = {
    status: "loading",
    value: void 0,
    revision: void 0,
    writable: false
  };
  const listeners = /* @__PURE__ */ new Set();
  let tail = Promise.resolve();
  const emit = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
      }
    }
  };
  const post = async (path, body) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {})
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.json();
  };
  const accept = (view) => {
    snapshot = {
      status: "ready",
      value: view?.value ?? {},
      revision: view?.revision,
      writable: true
    };
    emit();
  };
  const read = async () => {
    try {
      const body = await post(API.describe, {});
      const view = body?.value?.namespaces?.find((entry) => entry.ns === NS);
      if (body?.ok !== true || view === void 0) throw new Error("settings bridge unavailable");
      accept(view);
    } catch {
      snapshot = { ...snapshot, status: "unavailable" };
      emit();
    }
  };
  const write = async (ops, expectedRevision) => {
    const revision = expectedRevision ?? snapshot.revision;
    const body = await post(API.mutate, {
      ns: NS,
      ops,
      ...revision === void 0 ? {} : { expectedRevision: revision }
    });
    if (body?.ok !== true) throw new Error(body?.message ?? body?.code ?? "\u4FDD\u5B58\u5931\u8D25");
    if (body.value !== void 0) accept(body.value);
  };
  const enqueue = (operation) => {
    const task = tail.then(operation, operation);
    tail = task.catch(() => {
    });
    return task;
  };
  void read();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (field, value) => enqueue(() => write([{ op: "set", path: [field], value }])),
    unset: (field) => enqueue(() => write([{ op: "unset", path: [field] }])),
    /**
     * Save a whole draft: empty values clear the field, except the secret,
     * where empty means "leave the stored auth code alone".
     * @param {Record<string, unknown>} draft - field values.
     * @returns {Promise<void>} resolves when every field was written.
     */
    save: (draft) => enqueue(async () => {
      for (const [field, value] of Object.entries(draft)) {
        if (field === "smtpPassword" && (value === "" || value === void 0)) continue;
        if (value === void 0 || value === null || value === "") await write([{ op: "unset", path: [field] }]);
        else await write([{ op: "set", path: [field], value }]);
      }
    }),
    /** Ask the host to send one test mail with the stored configuration. */
    sendTest: async () => {
      const body = await post(API.test, {});
      if (body?.ok !== true) throw new Error(body?.error ?? "\u53D1\u9001\u5931\u8D25");
      return body.recipients ?? [];
    },
    refresh: read
  };
}

// src/client/SettingsCard.jsx
var scope = createSettingsScope();
var FIELDS = [
  { key: "smtpHost", label: "SMTP \u670D\u52A1\u5668", placeholder: "smtp.qq.com", hint: "\u4F8B\u5982 smtp.qq.com\u3001smtp.163.com" },
  { key: "smtpPort", label: "\u7AEF\u53E3", placeholder: "465", type: "number", hint: "465 \u914D SSL\uFF1B587 \u914D STARTTLS" },
  { key: "smtpUser", label: "\u53D1\u4EF6\u90AE\u7BB1", placeholder: "xxx@qq.com", hint: "\u767B\u5F55\u90AE\u7BB1\u5730\u5740" },
  { key: "smtpPassword", label: "\u6388\u6743\u7801", placeholder: "\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539", type: "password", hint: "\u90AE\u7BB1\u8BBE\u7F6E\u91CC\u751F\u6210\u7684 SMTP \u6388\u6743\u7801\uFF0C\u4E0D\u662F\u767B\u5F55\u5BC6\u7801" },
  { key: "mailFrom", label: "\u53D1\u4EF6\u4EBA", placeholder: "DSH <xxx@qq.com>", hint: "\u53EF\u4EE5\u5E26\u663E\u793A\u540D" },
  { key: "mailTo", label: "\u9ED8\u8BA4\u6536\u4EF6\u4EBA", placeholder: "xxx@qq.com", hint: "\u591A\u4E2A\u7528\u9017\u53F7\u5206\u9694" }
];
var rowStyle = {
  display: "grid",
  gridTemplateColumns: "140px 1fr",
  gap: "8px 12px",
  alignItems: "center",
  marginBottom: "12px"
};
var labelStyle = { fontSize: 13, opacity: 0.75 };
var hintStyle = { fontSize: 12, opacity: 0.5, gridColumn: "2", marginTop: -6 };
var inputStyle = {
  width: "100%",
  padding: "6px 10px",
  fontSize: 13,
  borderRadius: 6,
  border: "1px solid rgba(128,128,128,0.35)",
  background: "rgba(128,128,128,0.06)",
  color: "inherit",
  boxSizing: "border-box"
};
var buttonStyle = {
  padding: "6px 14px",
  fontSize: 13,
  borderRadius: 6,
  border: "1px solid rgba(128,128,128,0.35)",
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  cursor: "pointer"
};
function SettingsCard() {
  const [snapshot, setSnapshot] = (0, import_react.useState)(scope.getSnapshot());
  const [draft, setDraft] = (0, import_react.useState)({});
  const [busy, setBusy] = (0, import_react.useState)("");
  const [message, setMessage] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => scope.subscribe(() => setSnapshot(scope.getSnapshot())), []);
  (0, import_react.useEffect)(() => {
    if (snapshot.status !== "ready") return;
    const value = snapshot.value ?? {};
    const next = {};
    for (const field of FIELDS) {
      const current = value[field.key];
      next[field.key] = current === void 0 || current === null ? "" : String(current);
    }
    next.enabled = value.enabled !== false;
    next.smtpSecure = value.smtpSecure !== false;
    setDraft((previous) => Object.keys(previous).length === 0 ? next : previous);
  }, [snapshot.status, snapshot.value]);
  if (snapshot.status === "loading") {
    return /* @__PURE__ */ import_react.default.createElement("div", { style: { padding: 16, fontSize: 13, opacity: 0.6 } }, "\u6B63\u5728\u8BFB\u53D6\u90AE\u4EF6\u914D\u7F6E\u2026");
  }
  if (snapshot.status === "unavailable") {
    return /* @__PURE__ */ import_react.default.createElement("div", { style: { padding: 16, fontSize: 13, color: "#c0392b" } }, "\u8BFB\u53D6\u914D\u7F6E\u5931\u8D25\uFF1A\u63D2\u4EF6\u7684\u672C\u5730\u6865\u63A5\u6CA1\u6709\u54CD\u5E94\u3002");
  }
  const update = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  const onSave = async () => {
    setBusy("save");
    setMessage(null);
    try {
      const payload = { ...draft };
      if (payload.smtpPort !== "") payload.smtpPort = Number(payload.smtpPort);
      await scope.save(payload);
      setMessage({ kind: "ok", text: "\u5DF2\u4FDD\u5B58\uFF0C\u7ACB\u5373\u751F\u6548\u3002" });
    } catch (error) {
      setMessage({ kind: "err", text: "\u4FDD\u5B58\u5931\u8D25\uFF1A" + (error?.message ?? String(error)) });
    } finally {
      setBusy("");
    }
  };
  const onTest = async () => {
    setBusy("test");
    setMessage(null);
    try {
      const recipients = await scope.sendTest();
      setMessage({ kind: "ok", text: `\u6D4B\u8BD5\u90AE\u4EF6\u5DF2\u53D1\u9001\u7ED9 ${recipients.join("\u3001") || "\u9ED8\u8BA4\u6536\u4EF6\u4EBA"}\uFF0C\u8BF7\u67E5\u6536\u3002` });
    } catch (error) {
      setMessage({ kind: "err", text: "\u6D4B\u8BD5\u53D1\u9001\u5931\u8D25\uFF1A" + (error?.message ?? String(error)) });
    } finally {
      setBusy("");
    }
  };
  return /* @__PURE__ */ import_react.default.createElement("div", { style: { padding: "4px 0" } }, /* @__PURE__ */ import_react.default.createElement("p", { style: { fontSize: 13, opacity: 0.65, margin: "0 0 16px" } }, "\u672C\u63D2\u4EF6\u7684 SMTP \u8D26\u6237\uFF0C\u4F9B AI \u4E3B\u52A8\u53D1\u4FE1\uFF08", /* @__PURE__ */ import_react.default.createElement("code", null, "send_mail"), "\uFF09\u3002\u4E0E\u300C\u90AE\u4EF6\u901A\u77E5\u300D\u63D2\u4EF6\u7684\u914D\u7F6E\u4E92\u4E0D\u5F71\u54CD\u3002"), /* @__PURE__ */ import_react.default.createElement("div", { style: rowStyle }, /* @__PURE__ */ import_react.default.createElement("span", { style: labelStyle }, "\u542F\u7528\u63D2\u4EF6"), /* @__PURE__ */ import_react.default.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 } }, /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      type: "checkbox",
      checked: draft.enabled !== false,
      onChange: (event) => update("enabled", event.target.checked)
    }
  ), draft.enabled !== false ? "\u5DF2\u542F\u7528" : "\u5DF2\u505C\u7528")), FIELDS.map((field) => /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, { key: field.key }, /* @__PURE__ */ import_react.default.createElement("div", { style: rowStyle }, /* @__PURE__ */ import_react.default.createElement("span", { style: labelStyle }, field.label), /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      style: inputStyle,
      type: field.type ?? "text",
      value: draft[field.key] ?? "",
      placeholder: field.placeholder,
      onChange: (event) => update(field.key, event.target.value),
      autoComplete: field.type === "password" ? "new-password" : void 0
    }
  ), field.hint ? /* @__PURE__ */ import_react.default.createElement("span", { style: hintStyle }, field.hint) : null))), /* @__PURE__ */ import_react.default.createElement("div", { style: rowStyle }, /* @__PURE__ */ import_react.default.createElement("span", { style: labelStyle }, "\u76F4\u8FDE SSL"), /* @__PURE__ */ import_react.default.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 } }, /* @__PURE__ */ import_react.default.createElement(
    "input",
    {
      type: "checkbox",
      checked: draft.smtpSecure !== false,
      onChange: (event) => update("smtpSecure", event.target.checked)
    }
  ), draft.smtpSecure !== false ? "\u5F00\u542F\uFF08465 \u7AEF\u53E3\uFF09" : "\u5173\u95ED\uFF08587 \u7AEF\u53E3\u7528 STARTTLS\uFF09")), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", gap: 10, marginTop: 20, alignItems: "center" } }, /* @__PURE__ */ import_react.default.createElement("button", { type: "button", style: buttonStyle, disabled: busy !== "", onClick: onSave }, busy === "save" ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58"), /* @__PURE__ */ import_react.default.createElement("button", { type: "button", style: buttonStyle, disabled: busy !== "", onClick: onTest }, busy === "test" ? "\u53D1\u9001\u4E2D\u2026" : "\u53D1\u9001\u6D4B\u8BD5\u90AE\u4EF6")), message ? /* @__PURE__ */ import_react.default.createElement("div", { style: { marginTop: 12, fontSize: 13, color: message.kind === "ok" ? "#1e8e5a" : "#c0392b" } }, message.text) : null);
}

// src/client/index.js
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("settings.section", () => {
    const unregister = ctx.slots.register({
      name: "settings.section",
      id: "tianshan-email",
      order: 150,
      label: () => "tianshan\u90AE\u4EF6"
    }, SettingsCard);
    return () => {
      unregister();
    };
  });
}
    return module.exports;
  }
});
