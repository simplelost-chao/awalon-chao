let task = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let taskToken = 0;
let allowReconnect = true;

function safeCloseTask(socketTask) {
  if (!socketTask || typeof socketTask.close !== "function") return;
  try {
    const result = socketTask.close();
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch (e) {}
}

function connect(url, handlers = {}) {
  const nextToken = taskToken + 1;
  allowReconnect = false;
  if (task) {
    safeCloseTask(task);
    task = null;
  }
  taskToken = nextToken;
  allowReconnect = true;

  task = wx.connectSocket({ url, timeout: 10000 });
  const token = taskToken;

  task.onOpen(() => {
    if (token !== taskToken) return;
    reconnectAttempts = 0;
    handlers.onOpen && handlers.onOpen();
  });

  task.onMessage((event) => {
    if (token !== taskToken) return;
    handlers.onMessage && handlers.onMessage(event.data);
  });

  task.onError((err) => {
    if (token !== taskToken) return;
    handlers.onError && handlers.onError(err);
  });

  task.onClose(() => {
    if (token !== taskToken) return;
    handlers.onClose && handlers.onClose();
    if (allowReconnect) {
      scheduleReconnect(url, handlers);
    }
  });

  return task;
}

function scheduleReconnect(url, handlers) {
  if (reconnectTimer) return;
  reconnectAttempts += 1;
  const delay = Math.min(1500 * reconnectAttempts, 8000);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(url, handlers);
  }, delay);
}

function send(data) {
  if (!task) return false;
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  try {
    task.send({ data: payload });
    return true;
  } catch (e) {
    return false;
  }
}

function close() {
  allowReconnect = false;
  taskToken += 1;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = 0;
  if (task) {
    safeCloseTask(task);
    task = null;
  }
}

module.exports = { connect, send, close };
