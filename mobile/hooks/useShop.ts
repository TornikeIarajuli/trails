import { useQuery } from '@tanstack/react-query';
import { shopService } from '../services/shop';
import { queryKeys } from '../utils/queryKeys';

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.shop.all(),
    queryFn: () => shopService.getProducts(),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.shop.detail(id),
    queryFn: () => shopService.getProduct(id),
    enabled: !!id,
  });
}
