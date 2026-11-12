import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChatProvider } from '../context/ChatContext.jsx';
import Sidebar from '../components/chat/Sidebar.jsx';
import ChatWindow from '../components/chat/ChatWindow.jsx';

function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <ChatWindow onOpenSidebar={() => setSidebarOpen(true)} />
    </div>
  );
}

export default function ChatPage() {
  const { conversationId } = useParams();
  return (
    <ChatProvider conversationId={conversationId ?? null}>
      <ChatLayout />
    </ChatProvider>
  );
}
