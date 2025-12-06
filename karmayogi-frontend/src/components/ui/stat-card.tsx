import * as React from "react"
import { cn } from "@/lib/utils"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  value: string | number
  icon?: React.ElementType
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    value: string
    icon?: React.ElementType
  }
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'default'
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, subtitle, value, icon: Icon, trend, color = 'default', ...props }, ref) => {
    const colorClasses = {
      blue: 'text-blue-400',
      green: 'text-green-400',
      red: 'text-red-400',
      yellow: 'text-yellow-400',
      default: 'text-slate-400'
    }

    const trendColors = {
      up: 'text-green-400',
      down: 'text-red-400',
      neutral: 'text-slate-400'
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-slate-100">{title}</h3>
            {subtitle && (
              <p className="text-sm text-slate-400">{subtitle}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-100">{value}</div>
            {trend && (
              <div className={`flex items-center ${trendColors[trend.direction]}`}>
                {trend.icon && <trend.icon className="h-4 w-4 mr-1" />}
                <span className="text-sm">{trend.value}</span>
              </div>
            )}
            {Icon && !trend && (
              <Icon className={`h-5 w-5 ${colorClasses[color]}`} />
            )}
          </div>
        </div>
      </div>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }