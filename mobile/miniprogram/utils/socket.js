let task = null;

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
  if (task) {
    // 先把旧 task 的 onClose 替换成空函数，防止它触发重连逻辑
    try { task.onClose(() => {}); } catch (e) {}
    safeCloseTask(task);
    task = null;
  }

  task = wx.connectSocket({ url, timeout: 10000 });

  task.onOpen(() => {
    handlers.onOpen && handlers.onOpen();
  });

  task.onMessage((event) => {
    handlers.onMessage && handlers.onMessage(event.data);
  });

  task.onError((err) => {
    handlers.onError && handlers.onError(err);
  });

  task.onClose(() => {
    handlers.onClose && handlers.onClose();
  });

  return task;
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
  if (task) {
    safeCloseTask(task);
    task = null;
  }
}

module.exports = { connect, send, close };
