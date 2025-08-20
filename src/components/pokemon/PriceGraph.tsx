'use client'

import { useState, useMemo, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { currencyService } from '@/lib/currency-service'
import { useI18n } from '@/contexts/I18nContext'
import { TrendingUp, Calendar, AlertCircle, Loader2 } from 'lucide-react'

interface PriceData {
  date: string
  price: number
  reverseHoloPrice?: number
  tcgplayerPrice?: number
  formattedDate: string
}

interface PriceGraphProps {
  cardId: string
  currentPrice: number | null
  reverseHoloPrice?: number | null
  avg7Days?: number | null
  avg30Days?: number | null
  cardName: string
  availableVariants?: string[]
  isCollectionValue?: boolean
}

type TimePeriod = '7d' | '1m' | '3m' | '1y'
type PriceVariant = 'normal' | 'reverse_holo' | 'tcgplayer' | 'all'

const TIME_PERIODS = [
  { key: '7d' as TimePeriod, label: '7 Days', days: 7, interval: 1 },
  { key: '1m' as TimePeriod, label: '1 Month', days: 30, interval: 1 },
  { key: '3m' as TimePeriod, label: '3 Months', days: 90, interval: 3 },
  { key: '1y' as TimePeriod, label: '1 Year', days: 365, interval: 7 }
]

export function PriceGraph({ cardId, currentPrice, reverseHoloPrice, avg7Days, avg30Days, cardName, availableVariants = [], isCollectionValue = false }: PriceGraphProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m')
  const [selectedVariant, setSelectedVariant] = useState<PriceVariant>('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historicalData, setHistoricalData] = useState<PriceData[]>([])
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()
  const [convertedPrices, setConvertedPrices] = useState<{
    currentPrice: number | null
    reverseHoloPrice: number | null
  }>({ currentPrice: null, reverseHoloPrice: null })

  // Fetch historical pricing data
  useEffect(() => {
    const fetchHistoricalData = async () => {
      if (!cardId) return
      
      setLoading(true)
      setError(null)
      
      try {
        const period = TIME_PERIODS.find(p => p.key === selectedPeriod)
        if (!period) return
        
        const response = await fetch(
          `/api/pricing/history?cardId=${cardId}&days=${period.days}&variant=${selectedVariant}&fillGaps=true`
        )
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch pricing data')
        }
        
        // Transform the data for the chart
        const transformedData: PriceData[] = result.data?.data?.map((point: any) => ({
          date: point.date,
          price: point.price,
          reverseHoloPrice: point.reverseHoloPrice,
          tcgplayerPrice: point.tcgplayerPrice,
          formattedDate: formatDateForPeriod(new Date(point.date), selectedPeriod)
        })) || []
        
        setHistoricalData(transformedData)
        
      } catch (error) {
        console.error('Error fetching historical pricing data:', error)
        setError(error instanceof Error ? error.message : 'Failed to load pricing data')
        
        // Fallback to empty data if real data fails
        setHistoricalData([])
      } finally {
        setLoading(false)
      }
    }

    fetchHistoricalData()
  }, [cardId, selectedPeriod, selectedVariant])

  // Convert EUR prices to user's preferred currency
  useEffect(() => {
    const convertPrices = async () => {
      if (preferredCurrency === 'EUR') {
        // No conversion needed
        setConvertedPrices({
          currentPrice,
          reverseHoloPrice: reverseHoloPrice || null
        })
        return
      }

      try {
        let convertedCurrent = null
        let convertedReverseHolo = null

        if (currentPrice) {
          const converted = await currencyService.convertPrice(
            { amount: currentPrice, currency: 'EUR', locale },
            preferredCurrency as any
          )
          convertedCurrent = converted.converted.amount
        }

        if (reverseHoloPrice) {
          const converted = await currencyService.convertPrice(
            { amount: reverseHoloPrice, currency: 'EUR', locale },
            preferredCurrency as any
          )
          convertedReverseHolo = converted.converted.amount
        }

        setConvertedPrices({
          currentPrice: convertedCurrent,
          reverseHoloPrice: convertedReverseHolo
        })
      } catch (error) {
        console.error('Currency conversion error in PriceGraph:', error)
        // Fallback to original prices
        setConvertedPrices({
          currentPrice,
          reverseHoloPrice: reverseHoloPrice || null
        })
      }
    }

    convertPrices()
  }, [currentPrice, reverseHoloPrice, preferredCurrency, locale])

  const formatDateForPeriod = (date: Date, period: TimePeriod): string => {
    switch (period) {
      case '7d':
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      case '1m':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      case '3m':
      case '1y':
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      default:
        return date.toLocaleDateString()
    }
  }

  // Generate simplified mock data - reduced complexity for better performance
  const generateMockData = useMemo(() => {
    if (!convertedPrices.currentPrice) return []

    const period = TIME_PERIODS.find(p => p.key === selectedPeriod)
    if (!period) return []

    const data: PriceData[] = []
    const now = new Date()
    
    // Simplified data generation with fewer points for better performance
    const dataPoints = Math.min(period.days / period.interval, 20) // Max 20 points for better performance
    const step = period.days / dataPoints
    
    for (let i = 0; i < dataPoints; i++) {
      const daysBack = Math.floor(i * step)
      const date = new Date(now)
      date.setDate(date.getDate() - daysBack)
      
      // Simple price variation - reduced complexity
      let price = convertedPrices.currentPrice * (0.95 + Math.random() * 0.1) // ±5% variation
      price = Math.max(0.01, Number(price.toFixed(2)))
      
      // Generate reverse holo price if available
      let reverseHoloPricePoint: number | undefined
      if (convertedPrices.reverseHoloPrice) {
        reverseHoloPricePoint = convertedPrices.reverseHoloPrice * (0.95 + Math.random() * 0.1) // ±5% variation
        reverseHoloPricePoint = Math.max(0.01, Number(reverseHoloPricePoint.toFixed(2)))
      }
      
      data.unshift({
        date: date.toISOString().split('T')[0],
        price,
        reverseHoloPrice: reverseHoloPricePoint,
        formattedDate: formatDateForPeriod(date, selectedPeriod)
      })
    }
    
    return data
  }, [convertedPrices.currentPrice, convertedPrices.reverseHoloPrice, selectedPeriod])

  const formatPrice = (value: number): string => {
    return currencyService.formatCurrency(value, preferredCurrency, locale)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-pkmn-surface border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm">{data.formattedDate}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="font-semibold" style={{ color: entry.color }}>
              {entry.dataKey === 'price' ? 'Normal: ' : 'Reverse Holo: '}
              {formatPrice(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Determine which data to use: historical if available, fallback to mock if needed
  const chartData = useMemo(() => {
    if (historicalData.length > 0) {
      return historicalData
    }
    // Fallback to mock data if no historical data
    return generateMockData
  }, [historicalData, generateMockData])

  const priceChange = useMemo(() => {
    if (chartData.length < 2) return null
    
    const firstPrice = chartData[0].price
    const lastPrice = chartData[chartData.length - 1].price
    const change = lastPrice - firstPrice
    const changePercent = (change / firstPrice) * 100
    
    // Only return price change if it's meaningful (> 0.01)
    if (Math.abs(change) <= 0.01) return null
    
    let reverseHoloChange = null
    if (convertedPrices.reverseHoloPrice && chartData[0].reverseHoloPrice && chartData[chartData.length - 1].reverseHoloPrice) {
      const firstReversePrice = chartData[0].reverseHoloPrice!
      const lastReversePrice = chartData[chartData.length - 1].reverseHoloPrice!
      const reverseChange = lastReversePrice - firstReversePrice
      const reverseChangePercent = (reverseChange / firstReversePrice) * 100
      
      // Only include reverse holo change if it's meaningful
      if (Math.abs(reverseChange) > 0.01) {
        reverseHoloChange = {
          absolute: reverseChange,
          percent: reverseChangePercent,
          isPositive: reverseChange >= 0
        }
      }
    }
    
    return {
      normal: {
        absolute: change,
        percent: changePercent,
        isPositive: change >= 0
      },
      reverseHolo: reverseHoloChange
    }
  }, [chartData, convertedPrices.reverseHoloPrice])

  if (!convertedPrices.currentPrice) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No pricing data available</p>
      </div>
    )
  }

  return (
    <div>
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-4 mb-4">
          <Loader2 className="w-5 h-5 animate-spin mr-2 text-pokemon-gold" />
          <span className="text-gray-400">Loading price history...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-center py-4 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 mr-2 text-red-400" />
          <span className="text-red-400 text-sm">
            {error} - Showing estimated data
          </span>
        </div>
      )}

      {/* Data Source Indicator */}
      {!loading && !error && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-gray-500">
            {historicalData.length > 0 ? (
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                Real market data
              </span>
            ) : (
              <span className="flex items-center">
                <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                Estimated from current prices
              </span>
            )}
          </div>
        </div>
      )}
      {priceChange && (
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1">
            <div className={`text-sm font-medium ${priceChange.normal.isPositive ? 'text-green-400' : 'text-yellow-400'}`}>
              Normal: {priceChange.normal.isPositive ? '+' : ''}{formatPrice(priceChange.normal.absolute)}
              ({priceChange.normal.isPositive ? '+' : ''}{priceChange.normal.percent.toFixed(1)}%)
            </div>
            {priceChange.reverseHolo && (
              <div className="text-sm font-medium text-blue-400">
                Reverse Holo: {priceChange.reverseHolo.isPositive ? '+' : ''}{formatPrice(priceChange.reverseHolo.absolute)}
                ({priceChange.reverseHolo.isPositive ? '+' : ''}{priceChange.reverseHolo.percent.toFixed(1)}%)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Variant Selector (if reverse holo is available) */}
      {availableVariants && availableVariants.includes('reverse_holo') && (
        <div className="flex space-x-1 mb-4 bg-pkmn-surface rounded-lg p-1">
          <button
            onClick={() => setSelectedVariant('normal')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              selectedVariant === 'normal'
                ? 'bg-pokemon-gold text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => setSelectedVariant('reverse_holo')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              selectedVariant === 'reverse_holo'
                ? 'bg-pokemon-gold text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            Reverse Holo
          </button>
          <button
            onClick={() => setSelectedVariant('all')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              selectedVariant === 'all'
                ? 'bg-pokemon-gold text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            Both
          </button>
        </div>
      )}

      {/* Time Period Selector */}
      <div className="flex space-x-1 mb-4 bg-pkmn-card rounded-lg p-1">
        {TIME_PERIODS.map((period) => (
          <button
            key={period.key}
            onClick={() => setSelectedPeriod(period.key)}
            disabled={loading}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedPeriod === period.key
                ? 'bg-pokemon-gold text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 15, left: 50, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="formattedDate"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              interval={
                selectedPeriod === '7d' ? 0 :
                selectedPeriod === '1m' ? 4 :
                selectedPeriod === '3m' ? 4 :
                selectedPeriod === '1y' ? 6 : 0
              }
              angle={selectedPeriod === '3m' || selectedPeriod === '1y' ? -45 : 0}
              textAnchor={selectedPeriod === '3m' || selectedPeriod === '1y' ? 'end' : 'middle'}
              height={selectedPeriod === '3m' || selectedPeriod === '1y' ? 60 : 30}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={formatPrice}
              domain={[0, 'dataMax + 0.5']}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={chartData.length <= 30 ? { fill: '#F59E0B', strokeWidth: 2, r: 3 } : false}
              activeDot={{ r: 5, stroke: '#F59E0B', strokeWidth: 2, fill: '#1F2937' }}
              name="Normal"
            />
            {(convertedPrices.reverseHoloPrice || selectedVariant === 'all' || selectedVariant === 'reverse_holo') && (
              <Line
                type="monotone"
                dataKey="reverseHoloPrice"
                stroke="#1E90FF"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={chartData.length <= 30 ? { fill: '#1E90FF', strokeWidth: 2, r: 3 } : false}
                activeDot={{ r: 5, stroke: '#1E90FF', strokeWidth: 2, fill: '#1F2937' }}
                name="Reverse Holo"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Current Price Display */}
      <div className="mt-4 pt-4 border-t border-gray-600">
        <div className="space-y-2">
          {convertedPrices.currentPrice && convertedPrices.currentPrice > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">
                {isCollectionValue ? 'Total Collection Value' : 'Normal Price'}
              </span>
              <span className="text-yellow-400 font-bold text-lg">
                {formatPrice(convertedPrices.currentPrice)}
              </span>
            </div>
          )}
          {!isCollectionValue && convertedPrices.reverseHoloPrice && convertedPrices.reverseHoloPrice > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Reverse Holo Price</span>
              <span className="text-blue-400 font-bold text-lg">
                {formatPrice(convertedPrices.reverseHoloPrice)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}