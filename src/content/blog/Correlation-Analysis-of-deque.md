---
draft: true
title: "[C++-STL] deque的分析"
pubDate: "2022-07-15"
description: "STL源码, 实现 stack 和 queue 都使用了 deque 作为适配器. deque 是什么？它的结构是什么？为什么 Stack和 Queue要用它来作为适配器实现？"
image: https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202306251815703.webp
categories:
    - Blogs
tags:
    - STL
    - 容器
---

STL源码实现 `Stack` 和 `Queue` 都使用了 `deque` 作为适配器

deque 是什么？它的结构是什么？为什么 Stack和 Queue要用它来作为适配器实现？

---

# 文档中的 deque

![  ](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20220715164827658.webp)

官方文档中这样解释 `deque`, 而通俗来讲 `deque` 就是一个可以前插后插、前删后删的动态开辟的线性结构的容器

并且, 这个 `deque` 拥有许多的成员函数:

![ ](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20220715165839711.webp)

这些成员函数功能, 好像 `list` 容器也有, 但是 为什么 `Stack`、`Queue`的要由它作为适配器实现呢？

# deque 结构介绍

我们都知道: 

> 1. **`vector`**, 占用的是连续的物理空间, 所以它具有他以下优缺点: 
>
>     优点: 
>
>     1. 尾插尾删, 时间复杂度为 O(1)
>     2. **可以随机访问**
>     3. cpu高速缓存命中率高
>
>     缺点: 
>
>     1. 头插头删、中间插中间删, 需要挪动数据, 效率低
>     2. 需要扩容 消耗资源, 并且有可能造成空间的浪费
>
> 2. **`list`**, 占用的物理空间是不连续的, 所以它具有以下优缺点: 
>
>     优点: 
>
>     1. **任意位置插入删除, 时间复杂度都是 O(1)**
>     2. 按需申请空间不会造成浪费
>
>     缺点: 
>
>     1. 不可随机访问
>     2. cpu高速缓存命中率低
>
> 其实, **使用 vector 一般都是有需要随机访问的需求；使用 list 一般是有频繁不定位置插入数据的的需求**
>
> 这两种容器, **vector的随机访问** 和 **list 的插入删除数据 O(1)**, 是他们的绝对优势

而 deque 的结构实现, 其实 在一定程度上综合了 vector 和 list 两种容器结构的优点 

list 是单个数据节点由指针相互连接

而 deque 的结构就像是 `以固定长度的可以存放多个数据的vector 为一个的节点 相互连接起来`

但是 并不是像list那样 个节点存储相邻结点的地址, 而是额外提供了一个vector来按顺序存放 deque中各个vector节点的地址

并且为了支持 双端操作, 还**提供了 两个迭代器分别指向 首数据位置和末数据位置**

所以 deque 的结构, 大致上是这样的: 

![ ](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20220715174037071.webp)

每段 vector 之间没有实际联系, 而是由另一个容器存放每个vector的地址, 且存放vector地址的容器也不是从首空间开始存放的, 因为需要考虑到头插新vector 需要添加指针

 **知道了 首元素位置与末元素位置, 有知道了每个vector之间的顺序, 且vector定长, 就可以通过计算位置来实现随机访问**

**并且, 在deque中尾插尾删、头插头删是不用挪动数据的, 因为 当vector满了之后, 会添加新的 vector**

这样的结构在一定程度上综合了 vector 和 list 的优点, 但是都没有优到vector和list的那种程度

所以, 综合一下, deque的优缺点有: 

> 优点: 
>
> 1. 可以先计算位置来实现, 随机访问, 效率比list遍历快得多
> 2. 头插尾插、头删尾删 时间复杂度都是 O(1)
> 3. 扩容代价较小
> 4. CPU高速缓存命中率 较高, 比 list 高
>
> 缺点: 
>
> 1. 中间插入删除效率不行
> 2. 虽然可以随机访问, 但是效率 还是比vector差, 因为需要先计算位置

所以, **deque 其实就是一个 功能多 但是功能效率不是非常高的 容器**

## 问题:  为什么 Stack 和 Queue 的实现, 要用 deque 来做适配器

要回答这个问题, 就得先明白 Stack 和 Queue 的结构、功能需要什么, 也就是 这两种容器的需求是什么？

> 1. 栈 Stack
>
>     先进后出, 只能尾插、尾删, 一般由 顺序表实现
>
> 2. 队列 Queue
>
>     先进先出, 只能尾插、头删, 一般由 链表实现

而 `deque` 功能齐全, 头插尾插、头删尾删 效率不差, 结构 综合了 链表与顺序表

其实 `deque` 适合用于 大量的头插尾插、头删尾删、偶尔随机访问 的场景, 而这 正是 Stack 和 Queue 需要的

