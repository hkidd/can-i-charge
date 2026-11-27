'use client'

import { useId, useState } from 'react'
import Toggle from './Toggle'
import MapFilterDialog from './MapFilterDialog'

interface MapFiltersProps {
    filters: {
        showDCFast: boolean
        showLevel2: boolean
        showLevel1: boolean
        showTesla: boolean
        showCCS: boolean
        opportunityMode: boolean
        usePortWeighting: boolean
    }
    onFilterChange: (filters: {
        showDCFast: boolean
        showLevel2: boolean
        showLevel1: boolean
        showTesla: boolean
        showCCS: boolean
        opportunityMode: boolean
        usePortWeighting: boolean
    }) => void
    isMobile?: boolean
    onClose?: () => void
}

export default function MapFilters({
    filters,
    onFilterChange,
    isMobile = false,
    onClose
}: MapFiltersProps) {
    const [speedExpanded, setSpeedExpanded] = useState(true)
    const [connectorExpanded, setConnectorExpanded] = useState(true)
    const [viewModeExpanded, setViewModeExpanded] = useState(true)
    const [isMinimized, setIsMinimized] = useState(false)
    const id = useId()

    const content = (
        <div
            className={`
            ${
                isMobile
                    ? 'flex max-h-[calc(100dvh-1rem)] flex-col hud-panel border-t border-white/10 rounded-t-3xl p-6'
                    : isMinimized
                    ? 'hud-panel rounded-full px-4 py-3 min-w-fit'
                    : 'hud-panel rounded-2xl p-5 min-w-[200px] max-w-[260px]'
            }
        `}
            style={isMobile ? { paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' } : undefined}
        >
            {isMobile && (
                <div className='flex shrink-0 items-center justify-between mb-6'>
                    <h3 id={`${id}-title`} className='text-lg font-bold text-foreground tracking-wide'>
                        FILTER STATIONS
                    </h3>
                    <button
                        type='button'
                        aria-label='Close map filters'
                        onClick={onClose}
                        className='w-11 h-11 shrink-0 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
                    >
                        <svg
                            className='w-4 h-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                        >
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M6 18L18 6M6 6l12 12'
                            />
                        </svg>
                    </button>
                </div>
            )}

            {!isMobile && (
                <div
                    className={
                        isMinimized ? '' : 'mb-4 border-b border-white/10 pb-3'
                    }
                >
                    <button
                        aria-expanded={!isMinimized}
                        aria-controls={`${id}-filters`}
                        onClick={() => setIsMinimized(!isMinimized)}
                        className={`w-full flex items-center ${
                            isMinimized
                                ? 'justify-center gap-2 text-xs font-medium text-foreground/80 hover:text-neon-mid transition-colors'
                                : 'justify-between text-[11px] font-mono font-bold uppercase tracking-widest text-foreground/70 hover:text-foreground transition-colors'
                        }`}
                    >
                        {isMinimized ? (
                            <>
                                <svg
                                    className='w-4 h-4'
                                    fill='none'
                                    stroke='currentColor'
                                    viewBox='0 0 24 24'
                                >
                                    <path
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        strokeWidth={2}
                                        d='M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'
                                    />
                                </svg>
                                <span>Filters</span>
                            </>
                        ) : (
                            <>
                                <span>Map Filters</span>
                                <span className='text-[9px] text-foreground/50 font-normal'>
                                    hide
                                </span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {(!isMinimized || isMobile) && (
                <div
                    id={`${id}-filters`}
                    className={`flex ${
                        isMobile ? 'min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain pr-1' : 'flex-col gap-3'
                    }`}
                >
                    {/* View Mode Section */}
                    <div className='border-b border-white/10 pb-3 mb-2'>
                        <button
                            aria-expanded={viewModeExpanded}
                            aria-controls={`${id}-view`}
                            onClick={() =>
                                setViewModeExpanded(!viewModeExpanded)
                            }
                            className='w-full flex items-center justify-between text-[9px] font-mono font-semibold uppercase tracking-widest text-foreground/60 mb-3 hover:text-foreground/80 transition-colors'
                        >
                            <span>View Mode</span>
                            <svg
                                className={`w-3 h-3 transition-transform ${
                                    viewModeExpanded ? 'rotate-0' : 'rotate-180'
                                }`}
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M19 9l-7 7-7-7'
                                />
                            </svg>
                        </button>

                        {viewModeExpanded && (
                            <div id={`${id}-view`} className='space-y-2'>
                                {/* Opportunity Mode */}
                                <div
                                    className={`flex items-center justify-between group ${
                                        isMobile
                                            ? 'p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20'
                                            : 'hover:bg-gradient-to-r hover:from-yellow-500/10 hover:to-orange-500/10 px-2 -mx-2 rounded-lg transition-all border border-transparent hover:border-yellow-500/20'
                                    }`}
                                >
                                    <div className='flex items-center gap-3 flex-1'>
                                        <div className='w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgb(251,191,36)] flex-shrink-0' />
                                        <div className='flex flex-col'>
                                            <span className='text-sm font-semibold text-foreground tracking-wide'>
                                                Opportunity Mode
                                            </span>
                                            <span className='text-[10px] text-foreground/60 font-mono'>
                                                2030 capacity missing · lower is better
                                            </span>
                                        </div>
                                    </div>
                                    <div className='flex items-center justify-center ml-2'>
                                        <Toggle
                                            label="Opportunity Mode"
                                            checked={filters.opportunityMode}
                                            onChange={(c) =>
                                                onFilterChange({
                                                    ...filters,
                                                    opportunityMode: c
                                                })
                                            }
                                            colorVar='neon-gold'
                                        />
                                    </div>
                                </div>

                                {/* Show Port Counts */}
                                <div
                                    className={`flex items-center justify-between group ${
                                        isMobile
                                            ? 'p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20'
                                            : 'hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10 px-2 -mx-2 rounded-lg transition-all border border-transparent hover:border-blue-500/20'
                                    }`}
                                >
                                    <div className='flex items-center gap-3 flex-1'>
                                        <div className='w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgb(59,130,246)] flex-shrink-0' />
                                        <div className='flex flex-col'>
                                            <span className='text-sm font-semibold text-foreground tracking-wide'>
                                                Show Port Counts
                                            </span>
                                            <span className='text-[10px] text-foreground/60 font-mono'>
                                                Count charging capacity vs
                                                stations
                                            </span>
                                        </div>
                                    </div>
                                    <div className='flex items-center justify-center ml-2'>
                                        <Toggle
                                            label="Show Port Counts"
                                            checked={filters.usePortWeighting}
                                            onChange={(c) =>
                                                onFilterChange({
                                                    ...filters,
                                                    usePortWeighting: c
                                                })
                                            }
                                            colorVar='neon-blue'
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Charging Speed Section */}
                    <div className='border-b border-white/10 pb-3 mb-2'>
                        <button
                            aria-expanded={speedExpanded}
                            aria-controls={`${id}-speed`}
                            onClick={() => setSpeedExpanded(!speedExpanded)}
                            className='w-full flex items-center justify-between text-[9px] font-mono font-semibold uppercase tracking-widest text-foreground/60 mb-3 hover:text-foreground/80 transition-colors'
                        >
                            <span>Charging Speed</span>
                            <svg
                                className={`w-3 h-3 transition-transform ${
                                    speedExpanded ? 'rotate-0' : 'rotate-180'
                                }`}
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M19 9l-7 7-7-7'
                                />
                            </svg>
                        </button>

                        {speedExpanded && (
                            <div id={`${id}-speed`} className='space-y-2'>
                                {/* DC Fast */}
                                <div
                                    className={`flex items-center justify-between group ${
                                        isMobile
                                            ? 'p-3 rounded-lg bg-white/5'
                                            : 'hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors'
                                    }`}
                                >
                                    <div className='flex items-center gap-3'>
                                        <div
                                            className='w-2 h-2 rounded-full shadow-[0_0_8px_var(--neon-high)]'
                                            style={{
                                                backgroundColor:
                                                    'var(--neon-high)'
                                            }}
                                        />
                                        <span className='text-sm font-medium text-foreground tracking-wide'>
                                            DC Fast
                                        </span>
                                    </div>
                                    <Toggle
                                        label="DC Fast"
                                        checked={filters.showDCFast}
                                        onChange={(c) =>
                                            onFilterChange({
                                                ...filters,
                                                showDCFast: c
                                            })
                                        }
                                        colorVar='neon-high'
                                    />
                                </div>

                                {/* Level 2 */}
                                <div
                                    className={`flex items-center justify-between group ${
                                        isMobile
                                            ? 'p-3 rounded-lg bg-white/5'
                                            : 'hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors'
                                    }`}
                                >
                                    <div className='flex items-center gap-3'>
                                        <div
                                            className='w-2 h-2 rounded-full shadow-[0_0_8px_var(--neon-mid)]'
                                            style={{
                                                backgroundColor:
                                                    'var(--neon-mid)'
                                            }}
                                        />
                                        <span className='text-sm font-medium text-foreground tracking-wide'>
                                            Level 2
                                        </span>
                                    </div>
                                    <Toggle
                                        label="Level 2"
                                        checked={filters.showLevel2}
                                        onChange={(c) =>
                                            onFilterChange({
                                                ...filters,
                                                showLevel2: c
                                            })
                                        }
                                        colorVar='neon-mid'
                                    />
                                </div>

                                {/* Level 1 */}
                                <div
                                    className={`flex items-center justify-between group ${
                                        isMobile
                                            ? 'p-3 rounded-lg bg-white/5'
                                            : 'hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors'
                                    }`}
                                >
                                    <div className='flex items-center gap-3'>
                                        <div
                                            className='w-2 h-2 rounded-full shadow-[0_0_8px_var(--neon-low)]'
                                            style={{
                                                backgroundColor:
                                                    'var(--neon-low)'
                                            }}
                                        />
                                        <span className='text-sm font-medium text-foreground tracking-wide'>
                                            Level 1
                                        </span>
                                    </div>
                                    <Toggle
                                        label="Level 1"
                                        checked={filters.showLevel1}
                                        onChange={(c) =>
                                            onFilterChange({
                                                ...filters,
                                                showLevel1: c
                                            })
                                        }
                                        colorVar='neon-low'
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Connector Type Section */}
                    <div>
                        <button
                            aria-expanded={connectorExpanded}
                            aria-controls={`${id}-connectors`}
                            onClick={() =>
                                setConnectorExpanded(!connectorExpanded)
                            }
                            className='w-full flex items-center justify-between text-[9px] font-mono font-semibold uppercase tracking-widest text-foreground/60 mb-3 hover:text-foreground/80 transition-colors'
                        >
                            <span>Connector Type</span>
                            <svg
                                className={`w-3 h-3 transition-transform ${
                                    connectorExpanded
                                        ? 'rotate-0'
                                        : 'rotate-180'
                                }`}
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M19 9l-7 7-7-7'
                                />
                            </svg>
                        </button>

                        {connectorExpanded && (
                            <div id={`${id}-connectors`} className='space-y-2'>
                                {/* Tesla/NACS */}
                                <div
                                    className={`flex items-center justify-between group ${
                                        isMobile
                                            ? 'p-3 rounded-lg bg-white/5'
                                            : 'hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors'
                                    }`}
                                >
                                    <div className='flex items-center gap-3'>
                                        <div className='w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_var(--neon-red)]' />
                                        <span className='text-sm font-medium text-foreground tracking-wide'>
                                            Tesla/NACS
                                        </span>
                                    </div>
                                    <Toggle
                                        label="Tesla/NACS"
                                        checked={filters.showTesla}
                                        onChange={(c) =>
                                            onFilterChange({
                                                ...filters,
                                                showTesla: c
                                            })
                                        }
                                        colorVar='neon-red'
                                    />
                                </div>

                                {/* CCS */}
                                <div
                                    className={`flex items-center justify-between group ${
                                        isMobile
                                            ? 'p-3 rounded-lg bg-white/5'
                                            : 'hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors'
                                    }`}
                                >
                                    <div className='flex items-center gap-3'>
                                        <div
                                            className='w-2 h-2 rounded-full shadow-[0_0_8px_var(--neon-orange)]'
                                            style={{
                                                backgroundColor:
                                                    'var(--neon-orange)'
                                            }}
                                        />
                                        <span className='text-sm font-medium text-foreground tracking-wide'>
                                            CCS/J1772
                                        </span>
                                    </div>
                                    <Toggle
                                        label="CCS/J1772"
                                        checked={filters.showCCS}
                                        onChange={(c) =>
                                            onFilterChange({
                                                ...filters,
                                                showCCS: c
                                            })
                                        }
                                        colorVar='neon-orange'
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )

    return isMobile ? (
        <MapFilterDialog titleId={`${id}-title`} onDismiss={() => onClose?.()}>
            {content}
        </MapFilterDialog>
    ) : content
}
