import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

/**
 * POST /mathematical/add-dimensions
 * Calls the mathematical_agent.py to append real-world dimensions to detections
 */
router.post('/add-dimensions', async (req, res) => {
  console.log('📥 Received request:', req.body);
  
  try {
    const { jsonPath, pixelsPerMeter, metersPerPixel } = req.body;

    // Validation
    if (!jsonPath) {
      console.error('❌ Missing jsonPath');
      return res.status(400).json({ error: 'jsonPath is required' });
    }

    if (!pixelsPerMeter && !metersPerPixel) {
      console.error('❌ Missing conversion factor');
      return res.status(400).json({ 
        error: 'Either pixelsPerMeter or metersPerPixel must be provided' 
      });
    }

    if (pixelsPerMeter && metersPerPixel) {
      console.error('❌ Both conversion factors provided');
      return res.status(400).json({ 
        error: 'Provide only one: pixelsPerMeter OR metersPerPixel' 
      });
    }

    // Check if file exists
    const fullPath = path.join(__dirname, '..', '..', jsonPath);
    console.log('🔍 Checking file at:', fullPath);
    
    if (!fs.existsSync(fullPath)) {
      console.error('❌ File not found:', fullPath);
      return res.status(404).json({ 
        error: 'JSON file not found',
        path: jsonPath 
      });
    }

    // Build arguments for Python script
    const pythonScript = path.join(__dirname, '..', '..', 'agents', 'mathematical_agent.py');
    const args = [pythonScript, fullPath];

    if (pixelsPerMeter) {
      args.push('--pixels-per-meter', pixelsPerMeter.toString());
    } else {
      args.push('--meters-per-pixel', metersPerPixel.toString());
    }

    console.log('🔧 Running mathematical agent:', args.join(' '));

    // Spawn Python process
    const pythonProcess = spawn('python', args);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('Python stdout:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Python script failed:', stderr);
        return res.status(500).json({
          error: 'Mathematical agent failed',
          details: stderr || stdout
        });
      }

      try {
        // Parse the output path from stdout
        const outputPathMatch = stdout.match(/SUCCESS: Updated JSON saved at: (.+)/);
        if (!outputPathMatch) {
          return res.status(500).json({
            error: 'Could not find output path in agent response',
            output: stdout
          });
        }

        const outputPath = outputPathMatch[1].trim();
        
        // Convert absolute path to relative path for URL
        const relativePath = outputPath.replace(/\\/g, '/').split('agents/outputs/')[1];
        const urlPath = `outputs/${relativePath}`;
        
        res.json({
          success: true,
          message: 'Dimensions added successfully',
          outputPath: urlPath,
          fullPath: outputPath,
          rawOutput: stdout
        });
      } catch (parseError) {
        console.error('❌ Error parsing Python output:', parseError);
        res.status(500).json({
          error: 'Failed to parse agent response',
          details: parseError.message,
          output: stdout
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('❌ Failed to start Python process:', error);
      res.status(500).json({
        error: 'Failed to start mathematical agent',
        details: error.message
      });
    });

  } catch (error) {
    console.error('❌ Route error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

export default router;