import { apiDelete, apiGet, apiPost } from '../api';
import { recipesService } from './recipesService';

jest.mock('../api', () => ({
  apiDelete: jest.fn(),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

const mockedApiDelete = apiDelete as jest.MockedFunction<typeof apiDelete>;
const mockedApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockedApiPost = apiPost as jest.MockedFunction<typeof apiPost>;

describe('recipesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts rating changes to the backend rate endpoint', async () => {
    mockedApiPost.mockResolvedValue({
      latestRating: 5,
      recipe: { id: 'recipe-1', title: 'Recipe 1' },
    } as never);

    const detail = await recipesService.rateRecipe('recipe-1', { rating: 5 });

    expect(mockedApiPost).toHaveBeenCalledWith('/recipes/recipe-1/rate', {
      rating: 5,
    });
    expect(detail.latestRating).toBe(5);
  });

  it('uses delete to remove favorites and post to add them back', async () => {
    mockedApiDelete.mockResolvedValue({
      isFavorite: false,
      recipe: { id: 'recipe-1', title: 'Recipe 1' },
    } as never);
    mockedApiPost.mockResolvedValueOnce({
      isFavorite: true,
      recipe: { id: 'recipe-1', title: 'Recipe 1' },
    } as never);

    const removed = await recipesService.setFavorite('recipe-1', false);
    const restored = await recipesService.setFavorite('recipe-1', true);

    expect(mockedApiDelete).toHaveBeenCalledWith('/recipes/recipe-1/favorite');
    expect(mockedApiPost).toHaveBeenCalledWith('/recipes/recipe-1/favorite');
    expect(removed.isFavorite).toBe(false);
    expect(restored.isFavorite).toBe(true);
  });

  it('encodes recipe list search queries into the API path', async () => {
    mockedApiGet.mockResolvedValue({
      scope: 'favorites',
      items: [],
    } as never);

    await recipesService.listRecipes('favorites', 'garlic chicken');

    expect(mockedApiGet).toHaveBeenCalledWith(
      '/recipes?scope=favorites&search=garlic%20chicken',
    );
  });
});
