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
    const state = task.readyState;
    // 已经连上且 url 相同，不重复建连
    if (state === 1) {
      // 重新挂载 handlers（页面重新 onShow 时更新回调）
      task.onOpen(() => handlers.onOpen && handlers.onOpen());
      task.onMessage((e) => handlers.onMessage && handlers.onMessage(e.data));
      task.onError((e) => handlers.onError && handlers.onError(e));
      task.onClose((r) => handlers.onClose && handlers.onClose(r && r.code));
      return task;
    }
    // CLOSING(2)：等关完再重连，避免"closed before established"
    if (state === 2) {
      try { task.onClose(() => {}); } catch (e) {}
      task = null;
      setTimeout(() => connect(url, handlers), 300);
      return null;
    }
    // CONNECTING(0)：丢弃引用，不主动 close（避免 "closed before established" 警告）
    // CLOSED(3)：正常替换
    if (state === 0) {
      try { task.onOpen(() => {}); task.onMessage(() => {}); task.onError(() => {}); task.onClose(() => {}); } catch (e) {}
      task = null;
    } else {
      try { task.onClose(() => {}); } catch (e) {}
      safeCloseTask(task);
      task = null;
    }
  }

  task = wx.connectSocket({ url, timeout: 30000 });

  task.onOpen(() => {
    handlers.onOpen && handlers.onOpen();
  });

  task.onMessage((event) => {
    handlers.onMessage && handlers.onMessage(event.data);
  });

  task.onError((err) => {
    handlers.onError && handlers.onError(err);
  });

  task.onClose((res) => {
    handlers.onClose && handlers.onClose(res && res.code);
  });

  return task;
}

function send(data) {
  if (!task) return false;
  // readyState: 0=CONNECTING 1=OPEN 2=CLOSING 3=CLOSED
  if (task.readyState !== 1) return false;
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
