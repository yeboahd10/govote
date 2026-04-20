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

export const getTotalVotesForResults = (results, votes) => {
  // If votes array is provided, count the number of votes (documents)
  if (Array.isArray(votes)) {
    return votes.length
  }
  
  // Fallback: count unique votes by dividing total selections by number of positions
  const totalVoteSelections = Object.values(results).reduce(
    (sum, candidates) => sum + candidates.reduce((candidateSum, candidate) => candidateSum + candidate.votes, 0),
    0
  )
  
  // Each vote has selections for all positions, so divide by number of positions
  return totalVoteSelections > 0 ? Math.ceil(totalVoteSelections / Object.keys(results).length) : 0
}
