const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Tagalog Dictionary API is running' });
});

app.get('/api/words/:word', async (req, res) => {
  try {
    const { word } = req.params;

    const wordQuery = `
      SELECT
        w.id,
        w.word,
        w.pronunciation,
        json_agg(
          json_build_object(
            'partOfSpeech', pos.name,
            'definitions', (
              SELECT json_agg(
                json_build_object(
                  'definition', d.definition,
                  'examples', (
                    SELECT json_agg(e.example_sentence)
                    FROM examples e
                    WHERE e.definition_id = d.id
                  )
                )
                ORDER BY d.definition_order
              )
              FROM definitions d
              WHERE d.word_id = w.id AND d.pos_id = pos.id
            )
          )
        ) as meanings
      FROM words w
      LEFT JOIN definitions def ON def.word_id = w.id
      LEFT JOIN parts_of_speech pos ON pos.id = def.pos_id
      WHERE LOWER(w.word) = LOWER($1)
      GROUP BY w.id, w.word, w.pronunciation
    `;

    const result = await pool.query(wordQuery, [word]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Hindi nahanap ang salita',
        message: 'Word not found'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching word:', error);
    res.status(500).json({
      error: 'May problema sa server',
      message: 'Internal server error'
    });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const searchQuery = `
      SELECT word, pronunciation
      FROM words
      WHERE word ILIKE $1
      ORDER BY word
      LIMIT 10
    `;

    const result = await pool.query(searchQuery, [`${q}%`]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(` Tagalog Dictionary API running on port ${port}`);
  console.log(` Accessible on your network: http://192.168.1.85:${port}/health`);
});
