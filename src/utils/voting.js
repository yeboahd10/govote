import { candidatePositions } from '../constants/candidates'

export const createEmptyResults = () =>
  Object.fromEntries(candidatePositions.map((position) => [position, []]))

export const buildResultsByPosition = (candidates, votes) => {
  const results = createEmptyResults()

  candidates.forEach((candidate) => {
    if (!results[candidate.position]) {
      results[candidate.position] = []
    }

    results[candidate.position].push({
      id: candidate.id,
      name: candidate.name,
      imageUrl: candidate.imageUrl ?? '',
      votes: 0,
    })
  })

  votes.forEach((vote) => {
    Object.entries(vote.selections ?? {}).forEach(([position, candidateId]) => {
      const candidate = results[position]?.find((entry) => entry.id === candidateId)

      if (candidate) {
        candidate.votes += 1
      }
    })
  })

  candidatePositions.forEach((position) => {
    results[position] = (results[position] ?? []).sort((first, second) => {
      if (second.votes !== first.votes) {
        return second.votes - first.votes
      }

      return first.name.localeCompare(second.name)
    })
  })

  return results
}

export const getTotalVotesForResults = (results) =>
  Object.values(results).reduce(
    (sum, candidates) => sum + candidates.reduce((candidateSum, candidate) => candidateSum + candidate.votes, 0),
    0
  )
