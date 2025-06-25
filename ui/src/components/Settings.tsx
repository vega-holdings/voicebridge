"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Save, Eye, EyeOff, TestTube, Server, Key, User, Mic, Phone } from "lucide-react"

interface Settings {
  // Twilio Configuration
  twilioAccountSid: string
  twilioAuthToken: string
  twilioPhoneNumber: string
  
  // OpenAI Configuration
  openaiApiKey: string
  openaiModel: string
  openaiVoice: string
  
  // Server Configuration
  port: string
  wsPort: string
  domain: string
  baseUrl: string
  
  // AI Instructions
  aiInstructions: string
  systemPersona: string
  
  // Call Settings
  maxCallDuration: string
  vadThreshold: string
  silenceTimeout: string
  reconnectInterval: string
  
  // Anti-detection
  enableJitter: boolean
  minJitterMs: string
  maxJitterMs: string
  
  // User Information
  userOrganization: string
  userLocation: string
  userRole: string
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-realtime-preview-2024-12-17',
    openaiVoice: 'alloy',
    port: '3000',
    wsPort: '3001',
    domain: 'localhost:3000',
    baseUrl: 'http://localhost',
    aiInstructions: `You are an AI assistant making calls on behalf of a citizen to discuss political issues. Be polite, concise, and professional. State your purpose clearly and present your argument respectfully. If asked, explain that you are an AI assistant helping to facilitate citizen engagement.`,
    systemPersona: `You are calling as a concerned citizen from [USER_LOCATION] representing [USER_ORGANIZATION]. You are [USER_ROLE] and are calling to express your views on important legislation.`,
    maxCallDuration: '300',
    vadThreshold: '1000000',
    silenceTimeout: '300',
    reconnectInterval: '540000',
    enableJitter: true,
    minJitterMs: '50',
    maxJitterMs: '150',
    userOrganization: '',
    userLocation: '',
    userRole: 'concerned citizen'
  })

  const [showSecrets, setShowSecrets] = useState({
    twilioAuthToken: false,
    openaiApiKey: false
  })

  const [isSaving, setIsSaving] = useState(false)
  const [testResults, setTestResults] = useState<{ [key: string]: 'pending' | 'success' | 'error' }>({})

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      
      if (response.ok) {
        alert('Settings saved successfully!')
      } else {
        alert('Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async (service: 'twilio' | 'openai') => {
    setTestResults(prev => ({ ...prev, [service]: 'pending' }))
    
    try {
      const response = await fetch(`/api/test/${service}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      
      const result = response.ok ? 'success' : 'error'
      setTestResults(prev => ({ ...prev, [service]: result }))
    } catch (error) {
      setTestResults(prev => ({ ...prev, [service]: 'error' }))
    }
  }

  const updateSetting = (key: keyof Settings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const toggleSecretVisibility = (key: keyof typeof showSecrets) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const voiceOptions = [
    { value: 'alloy', label: 'Alloy (Neutral)' },
    { value: 'echo', label: 'Echo (Male)' },
    { value: 'fable', label: 'Fable (British Male)' },
    { value: 'onyx', label: 'Onyx (Deep Male)' },
    { value: 'nova', label: 'Nova (Female)' },
    { value: 'shimmer', label: 'Shimmer (Soft Female)' }
  ]

  return (
    <div className="space-y-6">
      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Twilio Settings */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Twilio Configuration
              <Button
                size="sm"
                variant="outline"
                onClick={() => testConnection('twilio')}
                disabled={testResults.twilio === 'pending'}
              >
                <TestTube className="h-3 w-3 mr-1" />
                {testResults.twilio === 'pending' ? 'Testing...' : 'Test'}
              </Button>
              {testResults.twilio === 'success' && <span className="text-green-600">✓</span>}
              {testResults.twilio === 'error' && <span className="text-red-600">✗</span>}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="twilioAccountSid">Account SID</Label>
                <Input
                  id="twilioAccountSid"
                  value={settings.twilioAccountSid}
                  onChange={(e) => updateSetting('twilioAccountSid', e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              
              <div>
                <Label htmlFor="twilioAuthToken">Auth Token</Label>
                <div className="relative">
                  <Input
                    id="twilioAuthToken"
                    type={showSecrets.twilioAuthToken ? 'text' : 'password'}
                    value={settings.twilioAuthToken}
                    onChange={(e) => updateSetting('twilioAuthToken', e.target.value)}
                    placeholder="********************************"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleSecretVisibility('twilioAuthToken')}
                  >
                    {showSecrets.twilioAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="twilioPhoneNumber">Phone Number</Label>
                <Input
                  id="twilioPhoneNumber"
                  value={settings.twilioPhoneNumber}
                  onChange={(e) => updateSetting('twilioPhoneNumber', e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
            </div>
          </div>

          {/* OpenAI Settings */}
          <div className="space-y-3 pt-4 border-t">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Mic className="h-4 w-4" />
              OpenAI Configuration
              <Button
                size="sm"
                variant="outline"
                onClick={() => testConnection('openai')}
                disabled={testResults.openai === 'pending'}
              >
                <TestTube className="h-3 w-3 mr-1" />
                {testResults.openai === 'pending' ? 'Testing...' : 'Test'}
              </Button>
              {testResults.openai === 'success' && <span className="text-green-600">✓</span>}
              {testResults.openai === 'error' && <span className="text-red-600">✗</span>}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="openaiApiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="openaiApiKey"
                    type={showSecrets.openaiApiKey ? 'text' : 'password'}
                    value={settings.openaiApiKey}
                    onChange={(e) => updateSetting('openaiApiKey', e.target.value)}
                    placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleSecretVisibility('openaiApiKey')}
                  >
                    {showSecrets.openaiApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="openaiModel">Model</Label>
                <Input
                  id="openaiModel"
                  value={settings.openaiModel}
                  onChange={(e) => updateSetting('openaiModel', e.target.value)}
                  placeholder="gpt-4o-realtime-preview-2024-12-17"
                />
              </div>
              
              <div>
                <Label htmlFor="openaiVoice">Voice</Label>
                <select 
                  id="openaiVoice"
                  value={settings.openaiVoice} 
                  onChange={(e) => updateSetting('openaiVoice', e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                >
                  {voiceOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="port">HTTP Port</Label>
              <Input
                id="port"
                value={settings.port}
                onChange={(e) => updateSetting('port', e.target.value)}
                placeholder="3000"
              />
            </div>
            
            <div>
              <Label htmlFor="wsPort">WebSocket Port</Label>
              <Input
                id="wsPort"
                value={settings.wsPort}
                onChange={(e) => updateSetting('wsPort', e.target.value)}
                placeholder="3001"
              />
            </div>
            
            <div>
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={settings.domain}
                onChange={(e) => updateSetting('domain', e.target.value)}
                placeholder="your-domain.com"
              />
            </div>
            
            <div>
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                value={settings.baseUrl}
                onChange={(e) => updateSetting('baseUrl', e.target.value)}
                placeholder="https://your-domain.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            AI & User Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="aiInstructions">AI Instructions</Label>
            <Textarea
              id="aiInstructions"
              value={settings.aiInstructions}
              onChange={(e) => updateSetting('aiInstructions', e.target.value)}
              rows={4}
              placeholder="Instructions for how the AI should behave during calls..."
            />
          </div>
          
          <div>
            <Label htmlFor="systemPersona">System Persona</Label>
            <Textarea
              id="systemPersona"
              value={settings.systemPersona}
              onChange={(e) => updateSetting('systemPersona', e.target.value)}
              rows={3}
              placeholder="Template for how the AI should identify itself (use [USER_LOCATION], [USER_ORGANIZATION], [USER_ROLE] placeholders)"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="userOrganization">Your Organization</Label>
              <Input
                id="userOrganization"
                value={settings.userOrganization}
                onChange={(e) => updateSetting('userOrganization', e.target.value)}
                placeholder="Climate Action Coalition"
              />
            </div>
            
            <div>
              <Label htmlFor="userLocation">Your Location</Label>
              <Input
                id="userLocation"
                value={settings.userLocation}
                onChange={(e) => updateSetting('userLocation', e.target.value)}
                placeholder="San Francisco, CA"
              />
            </div>
            
            <div>
              <Label htmlFor="userRole">Your Role</Label>
              <Input
                id="userRole"
                value={settings.userRole}
                onChange={(e) => updateSetting('userRole', e.target.value)}
                placeholder="concerned citizen"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxCallDuration">Max Call Duration (seconds)</Label>
              <Input
                id="maxCallDuration"
                value={settings.maxCallDuration}
                onChange={(e) => updateSetting('maxCallDuration', e.target.value)}
                placeholder="300"
              />
            </div>
            
            <div>
              <Label htmlFor="vadThreshold">Voice Detection Threshold</Label>
              <Input
                id="vadThreshold"
                value={settings.vadThreshold}
                onChange={(e) => updateSetting('vadThreshold', e.target.value)}
                placeholder="1000000"
              />
            </div>
            
            <div>
              <Label htmlFor="silenceTimeout">Silence Timeout (ms)</Label>
              <Input
                id="silenceTimeout"
                value={settings.silenceTimeout}
                onChange={(e) => updateSetting('silenceTimeout', e.target.value)}
                placeholder="300"
              />
            </div>
            
            <div>
              <Label htmlFor="reconnectInterval">Reconnect Interval (ms)</Label>
              <Input
                id="reconnectInterval"
                value={settings.reconnectInterval}
                onChange={(e) => updateSetting('reconnectInterval', e.target.value)}
                placeholder="540000"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enableJitter"
                checked={settings.enableJitter}
                onChange={(e) => updateSetting('enableJitter', e.target.checked)}
                className="rounded border"
              />
              <Label htmlFor="enableJitter">Enable Anti-Detection Jitter</Label>
            </div>
            
            {settings.enableJitter && (
              <>
                <div>
                  <Label htmlFor="minJitterMs">Min Jitter (ms)</Label>
                  <Input
                    id="minJitterMs"
                    value={settings.minJitterMs}
                    onChange={(e) => updateSetting('minJitterMs', e.target.value)}
                    placeholder="50"
                  />
                </div>
                
                <div>
                  <Label htmlFor="maxJitterMs">Max Jitter (ms)</Label>
                  <Input
                    id="maxJitterMs"
                    value={settings.maxJitterMs}
                    onChange={(e) => updateSetting('maxJitterMs', e.target.value)}
                    placeholder="150"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={isSaving} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}