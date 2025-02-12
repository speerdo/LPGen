import type { WebsiteStyle } from '../../types/database';

export function getDefaultTemplate(style?: WebsiteStyle): string {
  const primaryColor = '#4F46E5';
  const textColor = '#1F2937';
  const backgroundColor = '#F9FAFB';
  const fontFamily = style?.fonts?.[0] || 'system-ui, -apple-system, sans-serif';
  const logo = style?.logo;
  const images = style?.images || [];
  const heroImage = images[0] || '';

  return `<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${style?.metaDescription || 'Welcome to our website'}">
    <title>Welcome</title>
    <style>
        :root {
            --primary: ${primaryColor};
            --text: ${textColor};
            --bg: ${backgroundColor};
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: ${fontFamily};
            color: var(--text);
            background: var(--bg);
            line-height: 1.5;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .hero {
            min-height: 80vh;
            display: flex;
            align-items: center;
            text-align: center;
            background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${heroImage}') center/cover;
            color: white;
        }
        
        h1 {
            font-size: 3rem;
            margin-bottom: 1.5rem;
        }
        
        p {
            font-size: 1.25rem;
            margin-bottom: 2rem;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .button {
            display: inline-block;
            background: var(--primary);
            color: white;
            padding: 1rem 2rem;
            border-radius: 0.5rem;
            text-decoration: none;
            transition: transform 0.2s;
        }
        
        .button:hover {
            transform: translateY(-2px);
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            padding: 4rem 0;
        }
        
        .feature {
            text-align: center;
        }
        
        .feature img {
            width: 100%;
            max-width: 300px;
            height: 200px;
            object-fit: cover;
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
        }
        
        @media (max-width: 768px) {
            h1 {
                font-size: 2rem;
            }
            
            .features {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <header>
        ${logo ? `<img src="${logo}" alt="Logo" style="max-width: 200px; margin: 1rem;">` : ''}
    </header>
    
    <main>
        <section class="hero">
            <div class="container">
                <h1>Welcome to Our Website</h1>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                <a href="#" class="button">Get Started</a>
            </div>
        </section>
        
        <section class="container">
            <div class="features">
                ${images.slice(1).map((img, i) => `
                <div class="feature">
                    <img src="${img}" alt="Feature ${i + 1}">
                    <h2>Feature ${i + 1}</h2>
                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                </div>
                `).join('')}
            </div>
        </section>
    </main>
</body>
</html>`;
}
