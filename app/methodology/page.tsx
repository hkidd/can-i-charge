import Link from 'next/link'
export default function Methodology() {
    return <main className='max-w-3xl mx-auto px-6 py-24 text-foreground space-y-6'>
        <Link href='/' className='text-blue-400'>← Can I Charge?</Link>
        <h1 className='text-4xl font-bold'>What does the readiness score mean?</h1>
        <p>The score estimates how much public charging provision an area has toward two planning targets: Level 2 charging and DC fast charging. A score of 100 means both modeled targets are met. It does not guarantee an open, working charger nearby.</p>
        <h2 className='text-2xl font-bold'>Demand comes from plug-in vehicles</h2>
        <p>We use the latest reviewed AFDC state registrations: battery electric and plug-in hybrid vehicles through 2025. For counties and ZIPs, we estimate the fleet using their share of the state’s Census population. Local ownership can differ substantially; these are estimates, not local registration counts.</p>
        <h2 className='text-2xl font-bold'>Two targets, no bonus points</h2>
        <p>Our benchmark scales the NREL national planning scenario of 1 million public Level 2 ports and 182,000 fast ports per 33 million plug-in vehicles. Fast-charging demand uses battery electric vehicles, based on the study’s 90% BEV / 10% PHEV scenario. The 2030 view uses that scenario mix. The study assumes 90% residential charging access; we have not measured local home-charging access. This applies a national planning ratio to local fleets; it is our model assumption, not an NREL rating of individual places. Level 2 contributes up to 85 points and fast charging up to 15, approximating that benchmark’s port mix. Each component is capped: excess fast ports cannot erase a Level 2 shortage, or vice versa. Level 1 ports remain visible but do not replace either target.</p>
        <p>Demand is adjusted by historical 2023 road miles per resident relative to the national level, bounded between one-half and twice the baseline. State or county traffic is used where available. ZIPs use a labeled state proxy. Road traffic includes non-EVs and through-travel, so this adjustment is an estimate of intensity, not observed EV charging demand.</p>
        <h2 className='text-2xl font-bold'>What supply counts?</h2>
        <p>We count reported compatible ports at public stations explicitly marked as unrestricted. Patron-only sites and sites with unknown access restrictions are excluded from the score. Connector and speed selections reduce supply against the same whole-area fleet target because connector-specific fleet counts are unavailable. Switching between port and station counts changes the displayed count, not the readiness calculation.</p>
        <p>At least 95% of eligible sites must report capacity. Unknown ports are never invented. Uptime, actual power, queues, home-charging access and geographic gaps within a region are not measured by this score. Treat it as a planning screen, not a complete site feasibility study.</p>
        <h2 className='text-2xl font-bold'>Opportunity Mode: a 2030 scenario</h2>
        <p><strong>Lower projected gap is better for readiness.</strong> A 0% gap means the modeled 2030 provision targets are met; a 100% gap means none of that weighted provision is covered. For example, a 78% gap means 22% of the modeled target is covered. A higher gap indicates more additional capacity is needed, not stronger readiness.</p>
        <p>Opportunity Mode shows the percentage of modeled provision still missing if the national plug-in fleet grows to 33 million vehicles by 2030, keeping today’s geographic shares and traffic intensity. It shows a scenario gap, not a forecast or proof that a site will be commercially viable. The map provides estimated target port counts and current provision alongside the gap.</p>
        <p>Readiness uses an absolute standard. Peer rankings do not contribute to the score. A state may have many chargers yet fall short if its EV fleet is proportionally larger. High scores in low-adoption areas can coexist with substantial future gaps.</p>
        <div className='space-y-2 text-blue-400'>
            <a className='block underline' href='https://afdc.energy.gov/vehicle-registration'>AFDC registration source</a>
            <a className='block underline' href='https://driveelectric.gov/files/2030-charging-network.pdf'>NREL national charging-network study</a>
            <a className='block underline' href='https://gaftp.epa.gov/Air/nei/2023/doc/TSD/calculation-of-emissions.html'>EPA traffic methodology</a>
        </div>
    </main>
}
