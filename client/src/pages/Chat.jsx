import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import API from "../services/api";
import socket from "../services/socket";

// Backend base URL for uploaded images/files
const SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "http://localhost:5000";

function Chat() {
  const navigate = useNavigate();

  // =========================================
  // STATES
  // =========================================

  const [users, setUsers] = useState([]);

  const [selectedUser, setSelectedUser] =
    useState(null);

  const [messages, setMessages] = useState([]);

  const [messageText, setMessageText] =
    useState("");

  const [loadingUsers, setLoadingUsers] =
    useState(true);

  const [loadingMessages, setLoadingMessages] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  // File states
  const [selectedFile, setSelectedFile] =
    useState(null);

  const [filePreview, setFilePreview] =
    useState(null);

  const [uploadingFile, setUploadingFile] =
    useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // =========================================
  // LOGGED-IN USER
  // =========================================

  const storedUser =
    localStorage.getItem("user");

  let loggedInUser = null;

  try {
    loggedInUser = storedUser
      ? JSON.parse(storedUser)
      : null;
  } catch {
    loggedInUser = null;
  }

  const loggedInUserId =
    loggedInUser?.id ||
    loggedInUser?._id ||
    null;

  // =========================================
  // LOGOUT
  // =========================================

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    socket.disconnect();

    navigate("/login");
  }, [navigate]);

  // =========================================
  // FETCH USERS
  // =========================================

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setError("");

      const response =
  await API.get(
    "/messages/summary"
  );

      const chatUsers =
        response.data.users || [];

      setUsers(chatUsers);

      // Select self by default
      setSelectedUser((currentSelectedUser) => {
        // Keep currently selected user
        // if that user still exists.
        if (currentSelectedUser?._id) {
          const existingUser =
            chatUsers.find(
              (user) =>
                user._id ===
                currentSelectedUser._id
            );

          if (existingUser) {
            return existingUser;
          }
        }

        // Otherwise select self.
        const selfUser =
          chatUsers.find(
            (user) => user.isSelf
          );

        return (
          selfUser ||
          chatUsers[0] ||
          null
        );
      });
    } catch (err) {
      console.error(
        "Fetch Users Error:",
        err
      );

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        logout();
        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to load users."
      );
    } finally {
      setLoadingUsers(false);
    }
  }, [logout]);


  // =========================================
  // MARK CHAT AS READ
  // =========================================

  const markAsRead = useCallback(
    async (userId) => {
      if (
        !userId ||
        userId === loggedInUserId
      ) {
        return;
      }

      try {
        await API.put(
          `/messages/read/${userId}`
        );

        setUsers((previousUsers) =>
          previousUsers.map((user) =>
            user._id === userId
              ? {
                  ...user,
                  unreadCount: 0,
                }
              : user
          )
        );
      } catch (err) {
        console.error(
          "Mark Read Error:",
          err
        );
      }
    },
    [loggedInUserId]
  );

  // =========================================
  // FETCH CONVERSATION
  // =========================================

  const fetchConversation =
    useCallback(async () => {
      if (!selectedUser?._id) {
        setMessages([]);
        return;
      }

      try {
        setLoadingMessages(true);
        setError("");

        const response =
          await API.get(
            `/messages/conversation/${selectedUser._id}`
          );

        setMessages(
          response.data.messages || []
        );
        if (
  selectedUser._id !==
  loggedInUserId
) {
  await markAsRead(
    selectedUser._id
  );
}
      } catch (err) {
        console.error(
          "Fetch Conversation Error:",
          err
        );

        if (
          err.response?.status === 401 ||
          err.response?.status === 403
        ) {
          logout();
          return;
        }

        setError(
          err.response?.data?.message ||
            "Unable to load messages."
        );
      } finally {
        setLoadingMessages(false);
      }
    }, [
  selectedUser?._id,
  logout,
  loggedInUserId,
  markAsRead,
]);

  // =========================================
  // INITIAL USER LOAD
  // =========================================

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // =========================================
  // LOAD SELECTED CONVERSATION
  // =========================================

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  // =========================================
  // SOCKET.IO
  // =========================================

  useEffect(() => {
    if (!loggedInUserId) {
      return;
    }

    const joinUserRoom = () => {
      socket.emit(
        "join-user",
        loggedInUserId
      );
    };

    if (!socket.connected) {
      socket.connect();
    }

    if (socket.connected) {
      joinUserRoom();
    }

    socket.on(
      "connect",
      joinUserRoom
    );

    const handleNewMessage = (message) => {
      const senderId =
        typeof message.sender === "object"
          ? message.sender?._id
          : message.sender;

      const receiverId =
        typeof message.receiver === "object"
          ? message.receiver?._id
          : message.receiver;

      if (!senderId || !receiverId) {
        return;
      }

      // -------------------------------------
      // Update sidebar last message
      // -------------------------------------

      setUsers((previousUsers) =>
        previousUsers.map((user) => {
          const userId = user._id;

          const isSelfMessage =
            senderId === loggedInUserId &&
            receiverId === loggedInUserId &&
            userId === loggedInUserId;

          const isUserConversation =
            userId !== loggedInUserId &&
            (
              (
                senderId === loggedInUserId &&
                receiverId === userId
              ) ||
              (
                senderId === userId &&
                receiverId === loggedInUserId
              )
            );

          if (
            isSelfMessage ||
            isUserConversation
          ) {
            return {
              ...user,
              lastMessage: message,
            };
          }

          return user;
        })
      );

      // -------------------------------------
      // Unread count
      // -------------------------------------

      if (
        receiverId === loggedInUserId &&
        senderId !== loggedInUserId
      ) {
        const conversationIsOpen =
          selectedUser?._id === senderId;

        if (conversationIsOpen) {
          markAsRead(senderId);
        } else {
          setUsers((previousUsers) =>
            previousUsers.map((user) =>
              user._id === senderId
                ? {
                    ...user,
                    unreadCount:
                      (user.unreadCount || 0) + 1,
                    lastMessage: message,
                  }
                : user
            )
          );
        }
      }

      // -------------------------------------
      // Add message to currently open chat
      // -------------------------------------

      const selectedId =
        selectedUser?._id;

      if (!selectedId) {
        return;
      }

      let belongsToConversation = false;

      if (
        selectedId === loggedInUserId &&
        senderId === loggedInUserId &&
        receiverId === loggedInUserId
      ) {
        belongsToConversation = true;
      }

      if (
        (
          senderId === loggedInUserId &&
          receiverId === selectedId
        ) ||
        (
          senderId === selectedId &&
          receiverId === loggedInUserId
        )
      ) {
        belongsToConversation = true;
      }

      if (!belongsToConversation) {
        return;
      }

      setMessages((previousMessages) => {
        const alreadyExists =
          previousMessages.some(
            (item) =>
              item._id === message._id
          );

        if (alreadyExists) {
          return previousMessages;
        }

        return [
          ...previousMessages,
          message,
        ];
      });
    };

    // Sync read state between laptop/mobile
    const handleConversationRead = ({
      userId,
    }) => {
      if (!userId) {
        return;
      }

      setUsers((previousUsers) =>
        previousUsers.map((user) =>
          user._id === userId
            ? {
                ...user,
                unreadCount: 0,
              }
            : user
        )
      );
    };

    socket.on(
      "new-message",
      handleNewMessage
    );

    socket.on(
      "conversation-read",
      handleConversationRead
    );

    return () => {
      socket.off(
        "connect",
        joinUserRoom
      );

      socket.off(
        "new-message",
        handleNewMessage
      );

      socket.off(
        "conversation-read",
        handleConversationRead
      );
    };
  }, [
    loggedInUserId,
    selectedUser?._id,
    markAsRead,
  ]);

  // =========================================
  // AUTO SCROLL
  // =========================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // =========================================
  // SEND TEXT MESSAGE
  // =========================================

  const sendMessage = async (e) => {
    e.preventDefault();

    const cleanMessage =
      messageText.trim();

    if (
      !selectedUser?._id ||
      !cleanMessage ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);
      setError("");

      await API.post(
        "/messages",
        {
          receiverId:
            selectedUser._id,

          text: cleanMessage,
        }
      );

      setMessageText("");
    } catch (err) {
      console.error(
        "Send Message Error:",
        err
      );

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        logout();
        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to send message."
      );
    } finally {
      setSending(false);
    }
  };

  // =========================================
  // CHECK MESSAGE OWNERSHIP
  // =========================================

  const isMyMessage = (
    message
  ) => {
    const senderId =
      typeof message.sender ===
      "object"
        ? message.sender?._id
        : message.sender;

    return (
      senderId ===
      loggedInUserId
    );
  };

  // =========================================
  // PREPARE FILE
  // =========================================

  const prepareFile = (file) => {
    if (!file) {
      return;
    }

    const maxSize =
      15 * 1024 * 1024;

    if (file.size > maxSize) {
      setError(
        "Maximum file size is 15 MB."
      );

      return;
    }

    setError("");

    // Remove previous preview URL
    if (filePreview) {
      URL.revokeObjectURL(
        filePreview
      );
    }

    setSelectedFile(file);

    if (
      file.type.startsWith(
        "image/"
      )
    ) {
      const previewUrl =
        URL.createObjectURL(file);

      setFilePreview(
        previewUrl
      );
    } else {
      setFilePreview(null);
    }
  };

  // =========================================
  // FILE SELECT
  // =========================================

  const handleFileSelect = (
    e
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    prepareFile(file);
  };

  // =========================================
  // CLIPBOARD IMAGE PASTE
  // =========================================

  const handlePaste = (e) => {
    const clipboardItems =
      e.clipboardData?.items;

    if (!clipboardItems) {
      return;
    }

    for (
      let i = 0;
      i <
      clipboardItems.length;
      i++
    ) {
      const item =
        clipboardItems[i];

      if (
        item.type.startsWith(
          "image/"
        )
      ) {
        const file =
          item.getAsFile();

        if (!file) {
          continue;
        }

        e.preventDefault();

        let extension =
          file.type
            .split("/")[1]
            ?.split("+")[0] ||
          "png";

        if (
          extension === "jpeg"
        ) {
          extension = "jpg";
        }

        const renamedFile =
          new File(
            [file],
            `clipboard-${Date.now()}.${extension}`,
            {
              type:
                file.type ||
                "image/png",
            }
          );

        prepareFile(
          renamedFile
        );

        break;
      }
    }
  };

  // =========================================
  // CANCEL ATTACHMENT
  // =========================================

  const cancelAttachment =
    () => {
      if (filePreview) {
        URL.revokeObjectURL(
          filePreview
        );
      }

      setSelectedFile(null);
      setFilePreview(null);

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    };

  // =========================================
  // UPLOAD FILE
  // =========================================

  const uploadFile = async () => {
    if (
      !selectedFile ||
      !selectedUser?._id ||
      uploadingFile
    ) {
      return;
    }

    try {
      setUploadingFile(true);
      setError("");

      const formData =
        new FormData();

      formData.append(
        "receiverId",
        selectedUser._id
      );

      formData.append(
        "file",
        selectedFile
      );

      await API.post(
        "/messages/upload",
        formData
      );

      cancelAttachment();
    } catch (err) {
      console.error(
        "Upload File Error:",
        err
      );

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        logout();
        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to upload file."
      );
    } finally {
      setUploadingFile(false);
    }
  };

  // =========================================
  // FILE URL
  // =========================================

  const getFileUrl = (
    fileUrl
  ) => {
    if (!fileUrl) {
      return "";
    }

    if (
      fileUrl.startsWith(
        "http://"
      ) ||
      fileUrl.startsWith(
        "https://"
      )
    ) {
      return fileUrl;
    }

    return `${SERVER_URL}${fileUrl}`;
  };

  // =========================================
// SHARE IMAGE / FILE
// =========================================

const shareFile = async (message) => {
  try {
    setError("");

    const fileUrl = getFileUrl(
      message.fileUrl
    );

    if (!fileUrl) {
      setError(
        "File URL is not available."
      );
      return;
    }

    // Try sharing the actual file first
    try {
      const response =
        await fetch(fileUrl);

      if (!response.ok) {
        throw new Error(
          "Unable to download file"
        );
      }

      const blob =
        await response.blob();

      const fileName =
        message.fileName ||
        `attachment-${Date.now()}`;

      const file =
        new File(
          [blob],
          fileName,
          {
            type:
              message.fileType ||
              blob.type ||
              "application/octet-stream",
          }
        );

      // Check whether browser can
      // share actual files
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [file],
        })
      ) {
        await navigator.share({
          files: [file],
          title:
            message.fileName ||
            "Harish Chat",
        });

        return;
      }
    } catch (fileShareError) {
      console.log(
        "Direct file sharing unavailable:",
        fileShareError
      );
    }

    // Fallback: share URL
    if (navigator.share) {
      await navigator.share({
        title:
          message.fileName ||
          "Harish Chat",

        text:
          "Shared from Harish Chat",

        url: fileUrl,
      });

      return;
    }

    // Desktop fallback
    await navigator.clipboard.writeText(
      fileUrl
    );

    alert(
      "File link copied to clipboard."
    );
  } catch (error) {
    // User cancelling share is not an error
    if (
      error?.name ===
      "AbortError"
    ) {
      return;
    }

    console.error(
      "Share Error:",
      error
    );

    setError(
      "Unable to share this file."
    );
  }
};

// =========================================
// DOWNLOAD FILE
// =========================================

const downloadFile = async (
  message
) => {
  try {
    setError("");

    const fileUrl =
      getFileUrl(
        message.fileUrl
      );

    const response =
      await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(
        "Download failed"
      );
    }

    const blob =
      await response.blob();

    const blobUrl =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      blobUrl;

    link.download =
      message.fileName ||
      "download";

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      blobUrl
    );
  } catch (error) {
    console.error(
      "Download Error:",
      error
    );

    setError(
      "Unable to download this file."
    );
  }
};

  // =========================================
  // SWITCH USER
  // =========================================

  const handleUserSelect = (
    user
  ) => {
    if (
      selectedUser?._id ===
      user._id
    ) {
      return;
    }

    cancelAttachment();

    setMessageText("");
    setError("");
    setMessages([]);
    setSelectedUser(user);
  };
  // =========================================
// LAST MESSAGE TEXT
// =========================================

const getLastMessageText = (
  user
) => {
  const lastMessage =
    user?.lastMessage;

  if (!lastMessage) {
    return user.isSelf
      ? "Self Chat"
      : user.email;
  }

  if (
    lastMessage.messageType ===
    "IMAGE"
  ) {
    return "📷 Image";
  }

  if (
    lastMessage.messageType ===
    "FILE"
  ) {
    return `📎 ${
      lastMessage.fileName ||
      "File"
    }`;
  }

  if (
    lastMessage.messageType ===
    "TEXT"
  ) {
    return (
      lastMessage.text ||
      "Message"
    );
  }

  return "Message";
};
// =========================================
// CHAT LIST TIME
// =========================================

const formatChatTime = (
  dateValue
) => {
  if (!dateValue) {
    return "";
  }

  const date =
    new Date(dateValue);

  const now =
    new Date();

  const today =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

  const messageDay =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

  const difference =
    Math.round(
      (today - messageDay) /
        (1000 * 60 * 60 * 24)
    );

  if (difference === 0) {
    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  if (difference === 1) {
    return "Yesterday";
  }

  return date.toLocaleDateString(
    [],
    {
      day: "2-digit",
      month: "short",
    }
  );
};

  // =========================================
  // UI
  // =========================================

  return (
    <div className="chat-page">
      {/* =====================================
          SIDEBAR
      ====================================== */}

      <aside className="chat-sidebar">
        <div className="chat-brand">
          <div>
            <h2>
              6is Chat
            </h2>

            <span>
              {loggedInUser?.name}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="chat-logout"
          >
            Logout
          </button>
        </div>

        <div className="chat-sidebar-title">
          Chats
        </div>

        <div className="chat-user-list">
          {loadingUsers ? (
            <div className="chat-placeholder">
              Loading users...
            </div>
          ) : users.length ===
            0 ? (
            <div className="chat-placeholder">
              No active users.
            </div>
          ) : (
            users.map(
              (user) => (
                <button
                  type="button"
                  key={
                    user._id
                  }
                  className={`chat-user ${
                    selectedUser?._id ===
                    user._id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    handleUserSelect(
                      user
                    )
                  }
                >
                  <div className="chat-avatar">
                    {user.name
                      ?.charAt(
                        0
                      )
                      .toUpperCase()}
                  </div>

                  <div className="chat-user-info">

  <div className="chat-user-top">

    <strong>
      {user.name}

      {user.isSelf &&
        " (You)"}
    </strong>

    {user.lastMessage?.createdAt && (
      <span className="chat-list-time">
        {formatChatTime(
          user.lastMessage.createdAt
        )}
      </span>
    )}

  </div>

  <div className="chat-user-bottom">

    <span className="chat-last-message">
      {getLastMessageText(
        user
      )}
    </span>

    {user.unreadCount > 0 && (
      <span className="unread-badge">
        {user.unreadCount > 99
          ? "99+"
          : user.unreadCount}
      </span>
    )}

  </div>

</div>
                </button>
              )
            )
          )}
        </div>
      </aside>

      {/* =====================================
          CONVERSATION
      ====================================== */}

      <main className="conversation-panel">
        {!selectedUser ? (
          <div className="no-conversation">
            Select a user to
            start chatting.
          </div>
        ) : (
          <>
            {/* HEADER */}

            <header className="conversation-header">
              <div className="chat-avatar">
                {selectedUser.name
                  ?.charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <strong>
                  {
                    selectedUser.name
                  }

                  {selectedUser.isSelf &&
                    " (You)"}
                </strong>

                <span>
                  {selectedUser.isSelf
                    ? "Your personal space"
                    : selectedUser.email}
                </span>
              </div>
            </header>

            {/* ERROR */}

            {error && (
              <div className="chat-error">
                {error}
              </div>
            )}

            {/* MESSAGES */}

            <section className="messages-area">
              {loadingMessages ? (
                <div className="chat-placeholder">
                  Loading
                  messages...
                </div>
              ) : messages.length ===
                0 ? (
                <div className="empty-conversation">
                  <div className="empty-icon">
                    💬
                  </div>

                  <h3>
                    {selectedUser.isSelf
                      ? "Your Self Chat"
                      : `Chat with ${selectedUser.name}`}
                  </h3>

                  <p>
                    {selectedUser.isSelf
                      ? "Send notes, copied data, images and files to yourself."
                      : "Send your first message."}
                  </p>
                </div>
              ) : (
                messages.map(
                  (message) => (
                    <div
                      key={
                        message._id
                      }
                      className={`message-row ${
                        isMyMessage(
                          message
                        )
                          ? "mine"
                          : "theirs"
                      }`}
                    >
                      <div className="message-bubble">
                        {/* TEXT */}

                        {message.messageType ===
                          "TEXT" && (
                          <div className="message-text">
                            {
                              message.text
                            }
                          </div>
                        )}

                        {/* IMAGE */}

                        {message.messageType ===
  "IMAGE" && (
  <div className="image-message">

    <img
      src={getFileUrl(
        message.fileUrl
      )}
      alt={
        message.fileName ||
        "Chat attachment"
      }
      loading="lazy"
      onClick={() =>
        window.open(
          getFileUrl(
            message.fileUrl
          ),
          "_blank",
          "noopener,noreferrer"
        )
      }
    />

    {message.fileName && (
      <span className="attachment-file-name">
        {message.fileName}
      </span>
    )}

    <div className="attachment-actions">

      <button
        type="button"
        onClick={() =>
          window.open(
            getFileUrl(
              message.fileUrl
            ),
            "_blank",
            "noopener,noreferrer"
          )
        }
      >
        Open
      </button>

      <button
        type="button"
        onClick={() =>
          downloadFile(
            message
          )
        }
      >
        Download
      </button>

      <button
        type="button"
        onClick={() =>
          shareFile(
            message
          )
        }
      >
        Share
      </button>

    </div>

  </div>
)}

                        {/* FILE */}

{message.messageType ===
  "FILE" && (
  <div className="file-message-container">

    <div className="file-message">

      <div className="file-icon">
        📄
      </div>

      <div className="file-details">

        <strong>
          {message.fileName ||
            "File"}
        </strong>

        <span>
          {message.fileType ||
            "Document"}
        </span>

      </div>

    </div>

    <div className="attachment-actions">

      <button
        type="button"
        onClick={() =>
          window.open(
            getFileUrl(
              message.fileUrl
            ),
            "_blank",
            "noopener,noreferrer"
          )
        }
      >
        Open
      </button>

      <button
        type="button"
        onClick={() =>
          downloadFile(
            message
          )
        }
      >
        Download
      </button>

      <button
        type="button"
        onClick={() =>
          shareFile(
            message
          )
        }
      >
        Share
      </button>

    </div>

  </div>
)}

                        {/* TIME */}

                        <div className="message-time">
                          {message.createdAt
                            ? new Date(
                                message.createdAt
                              ).toLocaleTimeString(
                                [],
                                {
                                  hour:
                                    "2-digit",
                                  minute:
                                    "2-digit",
                                }
                              )
                            : ""}
                        </div>
                      </div>
                    </div>
                  )
                )
              )}

              <div
                ref={
                  messagesEndRef
                }
              />
            </section>

            {/* =================================
                MESSAGE COMPOSER
            ================================== */}

            <div className="message-composer">
              {/* ATTACHMENT PREVIEW */}

              {selectedFile && (
                <div className="attachment-preview">
                  {filePreview ? (
                    <img
                      src={
                        filePreview
                      }
                      alt="Preview"
                    />
                  ) : (
                    <div className="document-preview">
                      📄
                    </div>
                  )}

                  <div className="attachment-info">
                    <strong>
                      {
                        selectedFile.name
                      }
                    </strong>

                    <span>
                      {(
                        selectedFile.size /
                        1024 /
                        1024
                      ).toFixed(
                        2
                      )}{" "}
                      MB
                    </span>
                  </div>

                  <button
                    type="button"
                    className="remove-attachment"
                    onClick={
                      cancelAttachment
                    }
                    disabled={
                      uploadingFile
                    }
                    title="Remove attachment"
                  >
                    ×
                  </button>

                  <button
                    type="button"
                    className="upload-attachment"
                    onClick={
                      uploadFile
                    }
                    disabled={
                      uploadingFile
                    }
                  >
                    {uploadingFile
                      ? "Uploading..."
                      : "Send"}
                  </button>
                </div>
              )}

              {/* MESSAGE FORM */}

              <form
                className="message-input-area"
                onSubmit={
                  sendMessage
                }
              >
                {/* HIDDEN FILE INPUT */}

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  hidden
                  accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.xls,.xlsx,.csv,.txt,.doc,.docx"
                  onChange={
                    handleFileSelect
                  }
                />

                {/* ATTACH BUTTON */}

                <button
                  type="button"
                  className="attachment-button"
                  title="Attach file"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  +
                </button>

                {/* TEXTAREA */}

                <textarea
                  placeholder={
                    selectedUser.isSelf
                      ? "Message yourself or paste an image..."
                      : `Message ${selectedUser.name}...`
                  }
                  value={
                    messageText
                  }
                  onChange={(
                    e
                  ) =>
                    setMessageText(
                      e.target
                        .value
                    )
                  }
                  onPaste={
                    handlePaste
                  }
                  onKeyDown={(
                    e
                  ) => {
                    if (
                      e.key ===
                        "Enter" &&
                      !e.shiftKey
                    ) {
                      e.preventDefault();

                      sendMessage(
                        e
                      );
                    }
                  }}
                />

                {/* SEND TEXT */}

                <button
                  type="submit"
                  disabled={
                    sending ||
                    !messageText.trim()
                  }
                >
                  {sending
                    ? "Sending..."
                    : "Send"}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default Chat;