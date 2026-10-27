import collection from '../data/solver-samples/ak-low-two-tone-collection.json' with { type: 'json' };
import ak9 from '../data/solver-samples/zeno-standard-btn-vs-straddle-200bb-AsKh9h-bet75/sample.json' with { type: 'json' };
import ak8 from '../data/solver-samples/zeno-standard-btn-vs-straddle-200bb-AsKh8h-bet75/sample.json' with { type: 'json' };
import ak7 from '../data/solver-samples/zeno-standard-btn-vs-straddle-200bb-AsKh7h-bet75/sample.json' with { type: 'json' };
import ak5 from '../data/solver-samples/zeno-standard-btn-vs-straddle-200bb-AsKh5h-bet75/sample.json' with { type: 'json' };
import ak4 from '../data/solver-samples/zeno-standard-btn-vs-straddle-200bb-AsKh4h-bet75/sample.json' with { type: 'json' };
import ak3 from '../data/solver-samples/zeno-standard-btn-vs-straddle-200bb-AsKh3h-bet75/sample.json' with { type: 'json' };
import ak2 from '../data/solver-samples/zeno-standard-btn-vs-straddle-200bb-AsKh2h-bet75/sample.json' with { type: 'json' };

// Only this explicitly curated seven-board standard-range collection is trained.
// The separate Mobius AK6 sample must never enter these averages.
export const averageSamples = [ak9, ak8, ak7, ak5, ak4, ak3, ak2];
for (const sample of averageSamples) {
  if (sample.collection_id !== collection.collection_id || !sample.provenance.uses_solver_standard_preflop_ranges || !sample.data_semantics.range_weights_provided || sample.action.size_fraction_of_pot !== .75 || !collection.samples.some(entry => entry.sample_id === sample.sample_id && entry.status === 'frequencies_and_weights_saved')) {
    throw new Error('The average trainer requires complete, standard-range samples from its collection.');
  }
}
export const averageSourceKey = averageSamples.map(s => s.provenance.raw_sha256 + s.provenance.range_weights.raw_sha256).join(':');
