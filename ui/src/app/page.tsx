"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ControlPanel from "@/components/ControlPanel"
import CallHistory from "@/components/CallHistory"
import Settings from "@/components/Settings"

export default function Home() {
  return (
    <main className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Voice Bridge Control Center</h1>
        <p className="text-muted-foreground">
          Manage automated political advocacy calls with AI-powered conversations
        </p>
      </div>

      <Tabs defaultValue="control" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="control">Control Panel</TabsTrigger>
          <TabsTrigger value="history">Call History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="control" className="space-y-4">
          <ControlPanel />
        </TabsContent>
        
        <TabsContent value="history" className="space-y-4">
          <CallHistory />
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          <Settings />
        </TabsContent>
      </Tabs>
    </main>
  )
}
