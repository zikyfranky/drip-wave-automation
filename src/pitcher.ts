import { run, query } from './database';

export async function generatePitches() {
    console.log('Generating pitches for pending issues...');
    
    try {
        const pending = await query('SELECT id, title, github_url FROM applications WHERE status = "PENDING" AND (pitch IS NULL OR pitch = "")');
        
        for (const issue of pending) {
            // Logic: High-precision technical pitch based on title keywords
            let pitch = 'I have extensive experience in full-stack development and system architecture. ';
            
            const title = issue.title.toLowerCase();
            
            if (title.includes('test') || title.includes('fix') || title.includes('bug')) {
                pitch = `I specialize in TDD and systematic debugging. I will implement robust test coverage and fix this issue with high precision while ensuring no regressions.`;
            } else if (title.includes('ui') || title.includes('css') || title.includes('design') || title.includes('heatmap') || title.includes('chart')) {
                pitch = `I have a strong background in frontend engineering and data visualization. I will ensure this UI enhancement is responsive, performant, and perfectly aligned with your design system.`;
            } else if (title.includes('contract') || title.includes('vote') || title.includes('proposal') || title.includes('governor') || title.includes('web3')) {
                pitch = `With my background in Web3 and smart contract governance, I can handle this technical requirement with the security and precision needed for protocol-level changes.`;
            } else if (title.includes('url') || title.includes('route') || title.includes('state') || title.includes('persist')) {
                pitch = `I will implement efficient state persistence and URL synchronization logic, ensuring a seamless and linkable user experience.`;
            } else if (title.includes('doc') || title.includes('readme') || title.includes('conduct') || title.includes('guide')) {
                pitch = `I understand the importance of clear documentation and community guidelines for OSS growth. I will provide high-quality, professional standards for this task.`;
            } else {
                pitch = `I am a systems-oriented engineer with deep expertise in Node.js and TypeScript. I have handled similar features before and can deliver a clean, maintainable solution within the Wave timeline.`;
            }

            await run('UPDATE applications SET pitch = ? WHERE id = ?', [pitch, issue.id]);
            console.log(`Generated pitch for issue #${issue.id}`);
        }
    } catch (err) {
        console.error('Pitcher error:', err);
    }
}
