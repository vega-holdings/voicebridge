"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Play, Download, Search, Filter, Calendar, Clock, Phone, User } from "lucide-react"

interface CallRecord {
  callSid: string
  contactName: string
  phoneNumber: string
  status: string
  duration: number
  createdAt: string
  completedAt?: string
  transcript: string
  recordingUrl?: string
  issue: string
}

interface TranscriptTurn {
  speaker: 'user' | 'assistant'
  content: string
  timestamp: string
}

export default function CallHistory() {
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)

  // Mock data - replace with actual API calls
  useEffect(() => {
    const mockCalls: CallRecord[] = [
      {
        callSid: "CS1234567890abcdef",
        contactName: "Senator Butts",
        phoneNumber: "+12025224261",
        status: "completed",
        duration: 180,
        createdAt: "2024-06-24T10:30:00Z",
        completedAt: "2024-06-24T10:33:00Z",
        transcript: "Assistant: Hello, this is an automated call regarding the Climate Action Bill. I'm calling on behalf of concerned citizens...\n\nStaff: Thank you for calling Senator Butts' office. How can I help you?\n\nAssistant: I'm calling to urge the Senator to support the Climate Action Bill currently in committee...",
        recordingUrl: "/audio/recordings/CS1234567890abcdef.wav",
        issue: "Climate Action Bill"
      },
      {
        callSid: "CS0987654321fedcba",
        contactName: "Congressman Nutts", 
        phoneNumber: "+12025551234",
        status: "failed",
        duration: 45,
        createdAt: "2024-06-24T09:15:00Z",
        completedAt: "2024-06-24T09:15:45Z",
        transcript: "Assistant: Hello, this is regarding Net Neutrality legislation...\n\n[Call disconnected - busy signal]",
        issue: "Net Neutrality"
      },
      {
        callSid: "CS1122334455667788",
        contactName: "State Senator Ligma",
        phoneNumber: "+12025559876", 
        status: "completed",
        duration: 240,
        createdAt: "2024-06-24T08:45:00Z",
        completedAt: "2024-06-24T08:49:00Z",
        transcript: "Assistant: Good morning, I'm calling about the Healthcare Funding Amendment...\n\nStaff: Let me transfer you to our policy director...\n\nPolicy Director: Hello, what specific concerns do you have?",
        recordingUrl: "/audio/recordings/CS1122334455667788.wav",
        issue: "Healthcare Funding Amendment"
      }
    ]
    setCalls(mockCalls)
  }, [])

  const filteredCalls = calls.filter(call => {
    const matchesSearch = 
      call.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.transcript.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || call.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const playRecording = async (recordingUrl: string) => {
    if (currentAudio) {
      currentAudio.pause()
      setCurrentAudio(null)
      setIsPlaying(false)
    }

    if (!recordingUrl) return

    try {
      const audio = new Audio(recordingUrl)
      audio.onplay = () => setIsPlaying(true)
      audio.onpause = () => setIsPlaying(false)
      audio.onended = () => {
        setIsPlaying(false)
        setCurrentAudio(null)
      }
      
      setCurrentAudio(audio)
      await audio.play()
    } catch (error) {
      console.error('Failed to play recording:', error)
    }
  }

  const downloadRecording = (recordingUrl: string, callSid: string) => {
    if (!recordingUrl) return
    
    const link = document.createElement('a')
    link.href = recordingUrl
    link.download = `call-recording-${callSid}.wav`
    link.click()
  }

  const downloadTranscript = (transcript: string, callSid: string, contactName: string) => {
    const blob = new Blob([transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transcript-${contactName.replace(/\s+/g, '-')}-${callSid}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Call List */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search calls..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="busy">Busy</option>
                <option value="no-answer">No Answer</option>
              </select>
            </div>

            {/* Call List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCalls.map((call) => (
                <div
                  key={call.callSid}
                  className={`border rounded p-3 cursor-pointer transition-colors ${
                    selectedCall?.callSid === call.callSid 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedCall(call)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-sm">{call.contactName}</h4>
                      <p className="text-xs text-muted-foreground">{call.issue}</p>
                    </div>
                    <div className="text-right">
                      <div className={`inline-block px-2 py-1 rounded text-xs ${
                        call.status === 'completed' ? 'bg-green-100 text-green-700' :
                        call.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {call.status}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDuration(call.duration)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(call.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(call.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              
              {filteredCalls.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No calls found matching your criteria
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Details */}
      <div className="lg:col-span-2 space-y-4">
        {selectedCall ? (
          <>
            {/* Call Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {selectedCall.contactName}
                  </span>
                  <div className="flex gap-2">
                    {selectedCall.recordingUrl && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => playRecording(selectedCall.recordingUrl!)}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          {isPlaying ? 'Playing...' : 'Play'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadRecording(selectedCall.recordingUrl!, selectedCall.callSid)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Audio
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadTranscript(selectedCall.transcript, selectedCall.callSid, selectedCall.contactName)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Transcript
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Phone:</span>
                    <p className="font-mono">{selectedCall.phoneNumber}</p>
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <p className={`capitalize ${
                      selectedCall.status === 'completed' ? 'text-green-600' :
                      selectedCall.status === 'failed' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {selectedCall.status}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span>
                    <p>{formatDuration(selectedCall.duration)}</p>
                  </div>
                  <div>
                    <span className="font-medium">Call ID:</span>
                    <p className="font-mono text-xs">{selectedCall.callSid}</p>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Started:</span>
                    <p>{formatDate(selectedCall.createdAt)}</p>
                  </div>
                  {selectedCall.completedAt && (
                    <div>
                      <span className="font-medium">Completed:</span>
                      <p>{formatDate(selectedCall.completedAt)}</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-4">
                  <span className="font-medium">Issue:</span>
                  <p className="mt-1 p-2 bg-muted rounded text-sm">{selectedCall.issue}</p>
                </div>
              </CardContent>
            </Card>

            {/* Transcript */}
            <Card>
              <CardHeader>
                <CardTitle>Call Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded p-4 max-h-96 overflow-y-auto bg-muted/20">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {selectedCall.transcript}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Select a Call</h3>
              <p className="text-muted-foreground">
                Choose a call from the history to view details and transcript
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}