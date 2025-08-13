import { useState, useEffect, useRef } from "react"
import { io } from "socket.io-client"

/**
 * Custom hook for managing live stock data via WebSocket connection
 * 
 * @param {string} serverUrl - The WebSocket server URL
 * @param {number} max - Maximum number of history entries to keep
 * @returns {Object} - { snapshot, history, domains }
 */
export function useLiveStockData(serverUrl = "http://localhost:5000", max = 1000) {
  const [snapshot, setSnapshot] = useState({
    price: null,
    signal: "HOLD",
    cash: null,
    holdings: null,
    portfolio_value: null,
    fees_paid: null,
  })
  const [history, setHistory] = useState([])
  const [domains, setDomains] = useState({})
  const maxRef = useRef(max)

  useEffect(() => {
    const socket = io(serverUrl, {
      transports: ["websocket"],
      reconnectionAttempts: 3,
    })

    const onUpdate = (data) => {
      setSnapshot(data)
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            time: new Date().toLocaleTimeString([], {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit"
            }),
            ...data
          }
        ]
        return next.slice(-maxRef.current)
      })

      setDomains((prev) => {
        const out = { ...prev }
        Object.entries(data).forEach(([key, val]) => {
          if (val == null || key === "signal") return
          if (!out[key]) out[key] = [val, val]
          else {
            if (val < out[key][0]) out[key][0] = val
            if (val > out[key][1]) out[key][1] = val
          }
        })
        return out
      })
    }

    socket.on("update", onUpdate)
    return () => socket.disconnect()
  }, [serverUrl])

  return { snapshot, history, domains }
}