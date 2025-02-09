import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  model: string
  createdAt: number
}

function App() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [model, setModel] = useState('llama3.2:latest')
  const [error, setError] = useState<string | null>(null)

  // Load chats from localStorage on initial render
  useEffect(() => {
    const savedChats = localStorage.getItem('ollama-chats')
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats)
      setChats(parsedChats)
      
      // Load the most recent chat if exists
      if (parsedChats.length > 0) {
        const mostRecentChat = parsedChats[0]
        setCurrentChatId(mostRecentChat.id)
        setMessages(mostRecentChat.messages)
        setModel(mostRecentChat.model)
      }
    }
  }, [])

  // Save chats to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('ollama-chats', JSON.stringify(chats))
  }, [chats])

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      model: model,
      createdAt: Date.now()
    }
    setChats(prev => [newChat, ...prev])
    setCurrentChatId(newChat.id)
    setMessages([])
  }

  const updateCurrentChat = (messages: Message[]) => {
    if (!currentChatId) return
    
    setChats(prev => prev.map(chat => {
      if (chat.id === currentChatId) {
        // Update chat title based on the first user message
        const firstUserMessage = messages.find(m => m.role === 'user')
        const title = firstUserMessage 
          ? firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
          : 'New Chat'
        
        return {
          ...chat,
          messages,
          title,
          model
        }
      }
      return chat
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // Create new chat if none exists
    if (!currentChatId) {
      createNewChat()
    }

    const userMessage: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    updateCurrentChat(newMessages)
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: input,
          stream: false,
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`API Error: ${response.status} ${errorData}`)
      }

      const data = await response.json()
      if (!data.response) {
        throw new Error('No response data received from Ollama')
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
      }
      const updatedMessages = [...newMessages, assistantMessage]
      setMessages(updatedMessages)
      updateCurrentChat(updatedMessages)
    } catch (error) {
      console.error('Error details:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const selectChat = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId)
    if (chat) {
      setCurrentChatId(chatId)
      setMessages(chat.messages)
      setModel(chat.model)
    }
  }

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChats(prev => prev.filter(chat => chat.id !== chatId))
    if (currentChatId === chatId) {
      const remainingChats = chats.filter(chat => chat.id !== chatId)
      if (remainingChats.length > 0) {
        selectChat(remainingChats[0].id)
      } else {
        setCurrentChatId(null)
        setMessages([])
      }
    }
  }

  const formatMessage = (content: string) => {
    return content.replace(/([.,!?])(?!\s)/g, '$1 ')
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="hidden md:flex w-[260px] bg-gray-800 flex-col p-2">
        <button 
          onClick={createNewChat}
          className="flex items-center gap-3 p-3 text-sm text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
        >
          <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"></path>
          </svg>
          New chat
        </button>
        
        <div className="mt-4 flex items-center gap-2 px-3">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-2 
                     text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="llama3.2:latest">Llama 3.2</option>
            <option value="mistral">Mistral</option>
            <option value="codellama">Code Llama</option>
            <option value="llama2">Llama2</option>
          </select>
        </div>

        {/* Chat History */}
        <div className="mt-4 flex-1 overflow-y-auto">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => selectChat(chat.id)}
              className={`group flex items-center gap-3 p-3 text-sm rounded-lg cursor-pointer
                ${chat.id === currentChatId ? 'bg-gray-700' : 'hover:bg-gray-700/50'}`}
            >
              <span className="flex-1 truncate text-gray-100">{chat.title}</span>
              <button
                onClick={(e) => deleteChat(chat.id, e)}
                className="hidden group-hover:block text-gray-400 hover:text-gray-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-white">Ollama Chat</h1>
                <p className="text-gray-400">Start a conversation with your AI assistant</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto pt-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`px-4 py-6 ${
                    message.role === 'assistant' ? 'bg-gray-800' : ''
                  }`}
                >
                  <div className="max-w-3xl mx-auto flex gap-4">
                    <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0
                      ${message.role === 'assistant' ? 'bg-green-600' : 'bg-blue-600'}`}>
                      {message.role === 'assistant' ? '🤖' : '👤'}
                    </div>
                    <div className="min-w-0 prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-4">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc ml-4 mb-4">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal ml-4 mb-4">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          code: ({ node, inline, children, ...props }) => (
                            <code
                              className={`${
                                inline
                                  ? 'bg-gray-700 px-1 py-0.5 rounded'
                                  : 'block bg-gray-700/50 p-4 rounded-lg overflow-x-auto'
                              }`}
                              {...props}
                            >
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {formatMessage(message.content)}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="px-4 py-6 bg-gray-800">
                  <div className="max-w-3xl mx-auto flex gap-4">
                    <div className="w-7 h-7 rounded bg-green-600 flex items-center justify-center shrink-0">
                      🤖
                    </div>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-700 bg-gray-800 p-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a message..."
                className="w-full bg-gray-700 text-white rounded-lg pl-4 pr-12 py-3 
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 
                         hover:text-white disabled:hover:text-gray-400 disabled:opacity-50"
              >
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" 
                     className="w-4 h-4 rotate-90" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"></path>
                </svg>
              </button>
            </form>
            {error && (
              <div className="mt-2 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
