# Задача 3.4: Оптимизация производительности

## 📋 Описание
Оптимизировать производительность: добавить кеширование для часто запрашиваемых данных, оптимизировать запросы к базе данных, добавить пагинацию для больших списков, настроить CDN для статических ресурсов.

## 🎯 Цели
- Улучшить время загрузки приложения
- Оптимизировать database queries
- Реализовать эффективное кеширование

## 🔧 Технические требования

### 1. Redis кеширование
Файл: `lib/cache.js`

```javascript
import Redis from 'ioredis';

// Инициализация Redis клиента
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export class Cache {
  static async get(key) {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  static async set(key, value, ttl = 3600) {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  static async del(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  static async invalidatePattern(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Cache invalidate error:', error);
      return false;
    }
  }

  // Специализированные методы для депозитов
  static async getDeposits(userId, page = 1, limit = 50) {
    const key = `deposits:${userId}:${page}:${limit}`;
    return await this.get(key);
  }

  static async setDeposits(userId, page, limit, deposits) {
    const key = `deposits:${userId}:${page}:${limit}`;
    return await this.set(key, deposits, 300); // 5 минут
  }

  static async invalidateUserDeposits(userId) {
    return await this.invalidatePattern(`deposits:${userId}:*`);
  }

  // Кеширование аналитики
  static async getAnalytics(startDate, endDate) {
    const key = `analytics:${startDate}:${endDate}`;
    return await this.get(key);
  }

  static async setAnalytics(startDate, endDate, data) {
    const key = `analytics:${startDate}:${endDate}`;
    return await this.set(key, data, 1800); // 30 минут
  }

  // Кеширование метрик
  static async getDashboardMetrics() {
    return await this.get('dashboard:metrics');
  }

  static async setDashboardMetrics(metrics) {
    return await this.set('dashboard:metrics', metrics, 600); // 10 минут
  }
}

export default Cache;
```

### 2. Оптимизированные database queries
Файл: `lib/database-optimized.js`

```javascript
import { Database } from './database';
import { Cache } from './cache';

export class OptimizedDatabase extends Database {
  // Пагинированные запросы с кешированием
  static async getDepositsByUserIdPaginated(userId, page = 1, limit = 50, useCache = true) {
    if (useCache) {
      const cached = await Cache.getDeposits(userId, page, limit);
      if (cached) return cached;
    }

    const offset = (page - 1) * limit;
    
    const { data, error } = await supabase
      .from('deposits')
      .select(`
        *,
        customer:customers(id, name, email),
        transactions:transactions(id, type, status, created_at)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const result = {
      deposits: data,
      pagination: {
        page,
        limit,
        hasMore: data.length === limit
      }
    };

    if (useCache) {
      await Cache.setDeposits(userId, page, limit, result);
    }

    return result;
  }

  // Оптимизированный поиск с индексами
  static async searchDeposits(filters, page = 1, limit = 50) {
    let query = supabase
      .from('deposits')
      .select(`
        *,
        customer:customers(id, name, email)
      `);

    // Применение фильтров с использованием индексов
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    if (filters.amountMin) {
      query = query.gte('amount', filters.amountMin * 100);
    }

    if (filters.amountMax) {
      query = query.lte('amount', filters.amountMax * 100);
    }

    const offset = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    return {
      deposits: data,
      pagination: {
        page,
        limit,
        hasMore: data.length === limit
      }
    };
  }

  // Batch операции для улучшения производительности
  static async updateMultipleDeposits(updates) {
    const promises = updates.map(({ id, data }) => 
      supabase
        .from('deposits')
        .update(data)
        .eq('id', id)
    );

    const results = await Promise.allSettled(promises);
    
    // Инвалидация кеша для затронутых пользователей
    const userIds = [...new Set(updates.map(u => u.userId))];
    await Promise.all(
      userIds.map(userId => Cache.invalidateUserDeposits(userId))
    );

    return results;
  }

  // Агрегированные запросы с кешированием
  static async getAggregatedStats(startDate, endDate, useCache = true) {
    if (useCache) {
      const cached = await Cache.getAnalytics(startDate, endDate);
      if (cached) return cached;
    }

    // Используем SQL для агрегации на уровне базы данных
    const { data, error } = await supabase.rpc('get_aggregated_stats', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) throw error;

    if (useCache) {
      await Cache.setAnalytics(startDate, endDate, data);
    }

    return data;
  }
}
```

### 3. SQL функции для агрегации
Файл: `database/functions.sql`

```sql
-- Функция для получения агрегированной статистики
CREATE OR REPLACE FUNCTION get_aggregated_stats(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_deposits', COUNT(*),
    'total_amount', COALESCE(SUM(amount), 0),
    'average_amount', COALESCE(AVG(amount), 0),
    'success_rate', ROUND(
      (COUNT(*) FILTER (WHERE status = 'captured')::decimal / 
       NULLIF(COUNT(*), 0) * 100), 2
    ),
    'status_distribution', (
      SELECT json_object_agg(status, count)
      FROM (
        SELECT status, COUNT(*) as count
        FROM deposits
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY status
      ) status_counts
    ),
    'daily_stats', (
      SELECT json_agg(
        json_build_object(
          'date', date,
          'deposits', deposits,
          'amount', amount
        )
      )
      FROM (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as deposits,
          COALESCE(SUM(amount), 0) as amount
        FROM deposits
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY DATE(created_at)
        ORDER BY date
      ) daily_data
    )
  ) INTO result
  FROM deposits
  WHERE created_at BETWEEN start_date AND end_date;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения топ клиентов
CREATE OR REPLACE FUNCTION get_top_customers(
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  limit_count integer DEFAULT 10
)
RETURNS json AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'customer_id', customer_id,
        'customer_name', customer_name,
        'customer_email', customer_email,
        'deposit_count', deposit_count,
        'total_amount', total_amount,
        'success_rate', success_rate
      )
    )
    FROM (
      SELECT 
        d.customer_id,
        c.name as customer_name,
        c.email as customer_email,
        COUNT(*) as deposit_count,
        SUM(d.amount) as total_amount,
        ROUND(
          (COUNT(*) FILTER (WHERE d.status = 'captured')::decimal / 
           COUNT(*) * 100), 2
        ) as success_rate
      FROM deposits d
      LEFT JOIN customers c ON d.customer_id = c.id
      WHERE d.created_at BETWEEN start_date AND end_date
      GROUP BY d.customer_id, c.name, c.email
      ORDER BY total_amount DESC
      LIMIT limit_count
    ) top_customers
  );
END;
$$ LANGUAGE plpgsql;
```

### 4. API оптимизация с кешированием
Файл: `pages/api/deposits/index.js`

```javascript
import { OptimizedDatabase } from '../../../lib/database-optimized';
import { Cache } from '../../../lib/cache';
import { requireAuth } from '../../../lib/auth-middleware';
import { rateLimit } from '../../../lib/rate-limiter';

async function handler(req, res) {
  const userId = req.user.id;

  if (req.method === 'GET') {
    return await getDepositsOptimized(req, res, userId);
  } else if (req.method === 'POST') {
    return await createDepositOptimized(req, res, userId);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getDepositsOptimized(req, res, userId) {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      dateFrom, 
      dateTo,
      useCache = 'true'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100); // Максимум 100 записей
    const shouldUseCache = useCache === 'true';

    let result;

    if (status || dateFrom || dateTo) {
      // Если есть фильтры, используем поиск без кеша
      result = await OptimizedDatabase.searchDeposits({
        userId,
        status,
        dateFrom,
        dateTo
      }, pageNum, limitNum);
    } else {
      // Простой запрос с кешированием
      result = await OptimizedDatabase.getDepositsByUserIdPaginated(
        userId, 
        pageNum, 
        limitNum, 
        shouldUseCache
      );
    }

    // Добавляем заголовки для кеширования на клиенте
    res.setHeader('Cache-Control', 'public, max-age=60'); // 1 минута
    res.setHeader('ETag', `"${JSON.stringify(result).length}"`);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching deposits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createDepositOptimized(req, res, userId) {
  try {
    const deposit = await OptimizedDatabase.createDeposit({
      ...req.validatedData,
      user_id: userId
    });

    // Инвалидация кеша пользователя
    await Cache.invalidateUserDeposits(userId);
    
    // Инвалидация dashboard метрик
    await Cache.del('dashboard:metrics');

    res.status(201).json({ deposit });
  } catch (error) {
    console.error('Error creating deposit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default rateLimit('deposits')(requireAuth(handler));
```

### 5. Frontend оптимизация
Файл: `hooks/useOptimizedDeposits.js`

```javascript
import { useState, useEffect, useCallback } from 'react';
import { useInfiniteQuery } from 'react-query';

export function useOptimizedDeposits(filters = {}) {
  const [deposits, setDeposits] = useState([]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery(
    ['deposits', filters],
    ({ pageParam = 1 }) => fetchDeposits(pageParam, filters),
    {
      getNextPageParam: (lastPage) => 
        lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
      staleTime: 60000, // 1 минута
      cacheTime: 300000, // 5 минут
    }
  );

  useEffect(() => {
    if (data) {
      const allDeposits = data.pages.flatMap(page => page.deposits);
      setDeposits(allDeposits);
    }
  }, [data]);

  const fetchDeposits = async (page, filters) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '50',
      ...filters
    });

    const response = await fetch(`/api/deposits?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch deposits');
    }

    return response.json();
  };

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    deposits,
    loadMore,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  };
}
```

### 6. Image optimization и CDN
Файл: `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization
  images: {
    domains: ['your-cdn-domain.com'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Compression
  compress: true,

  // Static file caching
  async headers() {
    return [
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=60',
          },
        ],
      },
    ];
  },

  // Bundle analyzer
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // Bundle splitting
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    };

    return config;
  },

  // Experimental features
  experimental: {
    optimizeCss: true,
    optimizeImages: true,
  },
};

module.exports = nextConfig;
```

### 7. Performance monitoring
Файл: `lib/performance.js`

```javascript
export class PerformanceMonitor {
  static measureApiCall(name, fn) {
    return async (...args) => {
      const start = performance.now();
      
      try {
        const result = await fn(...args);
        const duration = performance.now() - start;
        
        console.log(`API Call ${name}: ${duration.toFixed(2)}ms`);
        
        // Отправка метрик в аналитику
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'timing_complete', {
            name: name,
            value: Math.round(duration)
          });
        }
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        console.error(`API Call ${name} failed after ${duration.toFixed(2)}ms:`, error);
        throw error;
      }
    };
  }

  static measureComponent(WrappedComponent, componentName) {
    return function MeasuredComponent(props) {
      useEffect(() => {
        const start = performance.now();
        
        return () => {
          const duration = performance.now() - start;
          console.log(`Component ${componentName} render time: ${duration.toFixed(2)}ms`);
        };
      }, []);

      return <WrappedComponent {...props} />;
    };
  }

  static reportWebVitals(metric) {
    console.log(metric);
    
    // Отправка в Google Analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        event_category: 'Web Vitals',
        event_label: metric.id,
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        non_interaction: true,
      });
    }
  }
}
```

## 📝 Шаги выполнения

### Шаг 1: Настройка Redis
1. Установить Redis (локально или в облаке)
2. Создать cache layer
3. Интегрировать в API endpoints

### Шаг 2: Оптимизация базы данных
1. Создать SQL функции для агрегации
2. Добавить индексы для часто используемых запросов
3. Реализовать пагинацию

### Шаг 3: Frontend оптимизация
1. Добавить React Query для кеширования
2. Реализовать infinite scrolling
3. Оптимизировать bundle size

### Шаг 4: CDN и статические ресурсы
1. Настроить Vercel CDN
2. Оптимизировать изображения
3. Добавить compression

### Шаг 5: Мониторинг производительности
1. Добавить performance metrics
2. Настроить Web Vitals tracking
3. Создать performance dashboard

## ✅ Критерии готовности
- [ ] Redis кеширование работает
- [ ] Database queries оптимизированы
- [ ] Пагинация реализована
- [ ] CDN настроен
- [ ] Bundle size оптимизирован
- [ ] Performance monitoring работает

## 🧪 Тестирование производительности

### Load testing
```bash
# Тестирование API с кешированием
ab -n 1000 -c 10 https://stripe-deposit.vercel.app/api/deposits
```

### Bundle analysis
```bash
npm run build
npm run analyze
```

## 🚨 Важные замечания
- Мониторить cache hit rates
- Регулярно очищать устаревший кеш
- Оптимизировать database queries
- Следить за bundle size
- Тестировать на медленных соединениях

## 📚 Полезные ссылки
- [Redis Documentation](https://redis.io/documentation)
- [Next.js Performance](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Web Vitals](https://web.dev/vitals/)

## 🔍 Проверка результата
После выполнения:
1. Время загрузки страниц улучшено
2. API responses быстрее
3. Database queries оптимизированы
4. Cache hit rate высокий
