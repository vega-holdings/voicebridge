"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Phone, Plus, Trash2, Play, Square, Volume2 } from "lucide-react"

interface Contact {
  id: string
  name: string
  title: string
  numbers: string[]
}

interface CallStatus {
  callSid?: string
  status: 'idle' | 'calling' | 'connected' | 'transcribing' | 'completed' | 'failed'
  transcript?: string
  duration?: number
}

export default function ControlPanel() {
  const [legislation, setLegislation] = useState("")
  const [script, setScript] = useState("")
  const [talkingPoints, setTalkingPoints] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: '1',
      name: 'Senator Butts',
      title: 'U.S. Senator',
      numbers: ['+12025224261', '+12025554567']
    },
    {
      id: '2',
      name: 'Congressman Nutts',
      title: 'U.S. Representative',
      numbers: ['+12025551234']
    },
    {
      id: '3',
      name: 'State Senator Ligma',
      title: 'State Senator',
      numbers: ['+12025559876']
    }
  ])
  const [newContact, setNewContact] = useState({ name: '', title: '', number: '' })
  const [callStatus, setCallStatus] = useState<CallStatus>({ status: 'idle' })
  const [selectedContact, setSelectedContact] = useState<string>('')
  const [liveTranscript, setLiveTranscript] = useState('')

  const addContact = () => {
    if (newContact.name && newContact.title && newContact.number) {
      const contact: Contact = {
        id: Date.now().toString(),
        name: newContact.name,
        title: newContact.title,
        numbers: [newContact.number]
      }
      setContacts([...contacts, contact])
      setNewContact({ name: '', title: '', number: '' })
    }
  }

  const addNumberToContact = (contactId: string, number: string) => {
    setContacts(contacts.map(contact => 
      contact.id === contactId 
        ? { ...contact, numbers: [...contact.numbers, number] }
        : contact
    ))
  }

  const removeContact = (id: string) => {
    setContacts(contacts.filter(contact => contact.id !== id))
  }

  const removeNumber = (contactId: string, numberIndex: number) => {
    setContacts(contacts.map(contact => 
      contact.id === contactId 
        ? { ...contact, numbers: contact.numbers.filter((_, index) => index !== numberIndex) }
        : contact
    ))
  }

  const startCall = async (contactId: string, numberIndex: number = 0) => {
    const contact = contacts.find(c => c.id === contactId)
    if (!contact || !contact.numbers[numberIndex]) return

    setCallStatus({ status: 'calling' })
    setSelectedContact(contactId)
    setLiveTranscript('')

    try {
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contact.numbers[numberIndex],
          contact: contact.name,
          legislation,
          script,
          talkingPoints
        })
      })

      const data = await response.json()
      if (data.callSid) {
        setCallStatus({ 
          status: 'connected', 
          callSid: data.callSid 
        })
        
        // Start listening for real-time updates
        const eventSource = new EventSource(`/api/calls/${data.callSid}/stream`)
        eventSource.onmessage = (event) => {
          const update = JSON.parse(event.data)
          if (update.type === 'transcript') {
            setLiveTranscript(prev => prev + update.content + '\n')
          } else if (update.type === 'status') {
            setCallStatus(prev => ({ ...prev, status: update.status }))
          }
        }
        
        eventSource.onerror = () => {
          eventSource.close()
        }
      }
    } catch (error) {
      console.error('Call failed:', error)
      setCallStatus({ status: 'failed' })
    }
  }

  const stopCall = async () => {
    if (callStatus.callSid) {
      try {
        await fetch(`/api/calls/${callStatus.callSid}`, {
          method: 'DELETE'
        })
      } catch (error) {
        console.error('Failed to stop call:', error)
      }
    }
    setCallStatus({ status: 'idle' })
    setLiveTranscript('')
  }

  const warDial = async () => {
    setCallStatus({ status: 'calling' })
    
    for (const contact of contacts) {
      for (let i = 0; i < contact.numbers.length; i++) {
        await startCall(contact.id, i)
        // Add delay between calls to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 30000)) // 30 second delay
      }
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Campaign Configuration */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="legislation">Legislation/Issue</Label>
              <Input
                id="legislation"
                placeholder="e.g., Climate Action Bill, Net Neutrality, Healthcare Funding"
                value={legislation}
                onChange={(e) => setLegislation(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="script">Call Script</Label>
              <Textarea
                id="script"
                placeholder="Main talking script for the AI to follow..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={4}
              />
            </div>
            
            <div>
              <Label htmlFor="talkingPoints">Key Talking Points</Label>
              <Textarea
                id="talkingPoints"
                placeholder="• Point 1: Urgent need for action&#10;• Point 2: Impact on constituents&#10;• Point 3: Call to action"
                value={talkingPoints}
                onChange={(e) => setTalkingPoints(e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Management */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add New Contact */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input
                placeholder="Name"
                value={newContact.name}
                onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
              />
              <Input
                placeholder="Title"
                value={newContact.title}
                onChange={(e) => setNewContact(prev => ({ ...prev, title: e.target.value }))}
              />
              <Input
                placeholder="Phone Number"
                value={newContact.number}
                onChange={(e) => setNewContact(prev => ({ ...prev, number: e.target.value }))}
              />
              <Button onClick={addContact} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Contact List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {contacts.map((contact) => (
                <div key={contact.id} className="border rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{contact.name}</h4>
                      <p className="text-sm text-muted-foreground">{contact.title}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeContact(contact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    {contact.numbers.map((number, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm font-mono">{number}</span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startCall(contact.id, index)}
                            disabled={callStatus.status !== 'idle'}
                          >
                            <Phone className="h-3 w-3 mr-1" />
                            Call
                          </Button>
                          {contact.numbers.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeNumber(contact.id, index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* War Dial */}
            <div className="pt-4 border-t">
              <Button
                onClick={warDial}
                disabled={callStatus.status !== 'idle' || contacts.length === 0}
                className="w-full"
                variant="destructive"
              >
                <Phone className="h-4 w-4 mr-2" />
                WAR DIAL ALL CONTACTS
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Calls all numbers sequentially with 30-second delays
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Status & Live Monitor */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Call Status
              <div className={`h-3 w-3 rounded-full ${
                callStatus.status === 'idle' ? 'bg-gray-400' :
                callStatus.status === 'calling' ? 'bg-yellow-400 animate-pulse' :
                callStatus.status === 'connected' ? 'bg-green-400' :
                callStatus.status === 'failed' ? 'bg-red-400' : 'bg-blue-400'
              }`} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Status:</strong> {callStatus.status.toUpperCase()}</p>
              {callStatus.callSid && (
                <p><strong>Call ID:</strong> {callStatus.callSid}</p>
              )}
              {selectedContact && (
                <p><strong>Calling:</strong> {contacts.find(c => c.id === selectedContact)?.name}</p>
              )}
              {callStatus.duration && (
                <p><strong>Duration:</strong> {Math.floor(callStatus.duration / 60)}:{String(callStatus.duration % 60).padStart(2, '0')}</p>
              )}
            </div>
            
            {callStatus.status !== 'idle' && (
              <Button
                onClick={stopCall}
                variant="destructive"
                className="mt-4 w-full"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Call
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Live Transcript */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Live Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded p-3 h-64 overflow-y-auto bg-muted/20">
              {liveTranscript ? (
                <pre className="text-sm whitespace-pre-wrap">{liveTranscript}</pre>
              ) : (
                <p className="text-muted-foreground">No active call...</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Live Audio Monitor */}
        <Card>
          <CardHeader>
            <CardTitle>Audio Monitor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">Incoming:</span>
                <div className="flex-1 h-2 bg-muted rounded">
                  <div 
                    className="h-full bg-blue-500 rounded transition-all duration-100"
                    style={{ width: `${Math.random() * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Outgoing:</span>
                <div className="flex-1 h-2 bg-muted rounded">
                  <div 
                    className="h-full bg-green-500 rounded transition-all duration-100"
                    style={{ width: `${Math.random() * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Real-time audio level monitoring
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}