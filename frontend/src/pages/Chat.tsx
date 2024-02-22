import React, { useEffect, useRef, useState } from "react"
import axios from "../helpers/axios"
import { useAuth } from "../context/authContext"
import { useNavigate, useParams } from "react-router-dom"
import "../style/chats.css"
import ChatHistory from "../components/ChatHistory"
import ConversationPair from "../components/ConversationPair"
import AddChatButton from "../components/AddChatButton"
import { getAIResponse } from "../helpers/api-fetcher"
import ChatPromptSubmitButton from "../components/ChatPromptSubmitButton"
import DefaultChatMessage from "../components/DefaultChatMessage"
// speech recognition
import "regenerator-runtime"
import speech, { useSpeechRecognition } from "react-speech-recognition"

type Thread = {
    _id: string,
    title: string
}

type Chat = {
    content: string,
    role: string
}

type ConversationPair = {
    _id: string,
    system: Chat | null,
    user: Chat
}

export default function Chats() {
    const [threads, setThreads] = useState<Thread[]>([]) // set in side bar
    const [conversationPairs, setConversationPairs] = useState<ConversationPair[]>([])
    const [isNewThread, setIsNewThread] = useState<boolean>(true) // state on whether it is first submit or not
    // TODO: change this to isNewThread
    const auth = useAuth()
    const navigate = useNavigate()

    const inputRef = useRef<HTMLInputElement | null>(null)
    const [prompt, setPrompt] = useState("")
    const {threadId} = useParams()


    // speech recognition logic
    const { listening, transcript } = useSpeechRecognition()
    useEffect(() => {
        const submitSpeechPrompt = async () =>{
            if (!listening && transcript && prompt) {
                // console.log("PROMPT: ", prompt)
                setPrompt(transcript)
                await promptSubmitLogic()
                // handlePromptSubmit()f
            } else setPrompt(transcript)
        }
        submitSpeechPrompt()
    }, [transcript, listening])

    const handlePromptSubmit = async (e) => {
        e.preventDefault()
        await promptSubmitLogic()
    }

    const handleCreateNewThread = async () => {
        setIsNewThread(true)
        setConversationPairs([])
        setPrompt("")
        navigate("/chats")
    }
    
    const handleLogOut = async () => {
        try {
            const logout = await auth?.logout()
            navigate("/")
        } catch (e) {
            console.log(e.message)
        }
    }

    const promptSubmitLogic = async () => {
        console.log("PROMPT: ", prompt)
        const newThread = isNewThread ?  await axios.post("/chat/thread", {
            title: prompt
        }) : null
        const newThreadId = newThread?.data.thread._id
        if (newThread) setThreads(prev => [newThread.data.thread, ...prev])
        setPrompt("")
        setConversationPairs(prev => [...prev, {
            _id: crypto.randomUUID(),
            user: {
                role: "User", 
                content: prompt
            },
            system: null
        }])
        const ai_res = await getAIResponse(prompt, newThreadId ? newThreadId : threadId)
        setIsNewThread(false)

        // pass in prompt and get ai, set it in thread

        setConversationPairs(prev => { // TODO: potentially clean up efficiency?
            const lastIndex = prev.length - 1
            return [...prev.slice(0, prev.length - 1), {
                ...prev[lastIndex],
                system: {
                    content: ai_res.response.response,
                    role: "System"
                },
                _id: ai_res.conversationPairId
                
            }];
        })
    }

    useEffect(() => {
        if (threadId) setIsNewThread(false)
        // fetch user chats from threadId and display them
        const getThreadChats = async () => {
            if (threadId) {
                const chats = await axios.post("/chat/getUserChats", {threadId}) // TODO: fix this as get req instead of post req
                if (chats.data) {
                    setConversationPairs(chats.data)
                } 
                else setConversationPairs([])
            }
        }
        getThreadChats()
    }, [threadId])

    // initial fetch of user's threads
    useEffect(() => {
        const ref = inputRef.current! // assert it's not null
        ref.focus()

        // initial fetch of threads
        async function getThreads() {
            const threads = await axios.get("/chat/threads")
            const data = await threads.data
            setThreads(data.threads)
        }
        getThreads()
    }, [])


    return (
        <section id="chats-container">
            <section id="sidebar">
                <AddChatButton handleClick={handleCreateNewThread} />
                <div id="user-threads">
                    {threads?.map(thread => (
                        <ChatHistory key={thread._id} threadId={thread._id} title={thread.title} />
                    ))}
                </div>
                <button id="logout-btn" onClick={handleLogOut}>Log Out</button>
            </section>
            <section id="messages">
                <div id="messages-content">
                    {
                        conversationPairs.length ? (
                            conversationPairs.map((pair) => (
                                <ConversationPair pair={pair} key={pair._id} />
                            ))
                        )
                        : <DefaultChatMessage />
                    } 
                </div>
                <div id="input-box">
                    <ChatPromptSubmitButton inputRef={inputRef} prompt={prompt} setPrompt={setPrompt} handlePromptSubmit={handlePromptSubmit} onSpeech={(e) =>{e.preventDefault();speech.startListening() } } />
                </div>
            </section>
        </section>
    )
}
