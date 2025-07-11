---
draft: true
title: "[数据结构] 红黑树的详析分析与实现"
pubDate: "2022-10-20"
description: '红黑树 也是一种 二叉平衡搜索树, 但是 其对平衡的控制 并没有像 AVL树 那样严格, 
红黑树 关于平衡的限制是: 最长的路径 不大于 最短路径的两倍'
image: https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/202306251816728.webp
categories:
    - Blogs
tags:
    - 数据结构
    - 红黑树
---

# 红黑树

`AVL树` 是一种 二叉平衡搜索树, 其结构特点可以用一个词来说明: `“绝对平衡”`。因为 `AVL树`的每个节点都完全满足 平衡的要求, 即 `左右子树的高度差不大于1`

`红黑树` 也是一种 二叉平衡搜索树, 但是 其对平衡的控制 并没有像 `AVL树` 那样严格, `红黑树` 关于平衡的限制是: `最长的路径 不大于 最短路径的两倍`

不过, `红黑树` 并`不直接对平衡进行控制`, 而是`通过对满足树的结构` 来`间接控制红黑树的平衡`

## 1. 红黑树的定义

`红黑树`是一种二叉平衡搜索, 所以其实还是 对二叉搜索树进行优化之后 诞生的一种二叉平衡搜索树

`红黑树`之所以被称为`红黑树`, 是因为 其节点拥有颜色标志: `红` 或 黑。并且 节点的颜色在树中遵循以下几个原则: 

1. 每个节点, 不是 `红` 就是 黑
2. 树的根节点是 黑 的
3. 如果节点是 `红`, 那么其两个孩子节点是 黑。即 不能存在连续的 `红` 节点
4. 对于每个节点, 从 此节点 到 其所有后代叶子节点 的 所有简单路径上, 黑 节点的数目相等
5. 每个 `空节点` 都是 黑 的, 即 叶子节点的左右孩子可看为 空的 黑 节点 

满足上面所有原则的一棵树 就是 `红黑树`: 

![|inline](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20230410140841332.webp)

> 1. 每个节点, 不是 `红` 就是 黑
>
>     树中只有 `红` 和 黑 两种颜色的节点
>
> 2. 树的根节点是 黑 的
>
> 3. 如果节点是 `红`, 那么其两个孩子节点是 黑。即 不能存在连续的 `红` 节点
>
>     树中, `红` 节点的孩子节点 均为 黑 节点 
>
> 4. 对于每个节点, 从 此节点 到 其所有后代叶子节点 的 所有简单路径上, 黑 节点的数目相等
>
>     例如(不算空节点): 
>
>     1. 从根节点开始: 21-`15`-7-`4` 、21-`15`-17 、21-`26`-22 、21-`26`-31-`30` 、21-`26`-31-`38`
>         每个路径中 黑 节点的个数都是 2
>
>     2. 从 15 节点开始: 15-7-4 、15-17
>
>         每个路径中 黑 节点的个数都是 1
>
>     3. 从 26 节点开始: `26`-22 、`26`-31-`30` 、`26`-31-`38`
>
>         每个路径中 黑 节点的个数都是 1
>
> 5. 每个 `空节点` 都是 黑 的
>
>     树中左孩子为空、右孩子为空的节点, 其空孩子都可以看作是 黑 节点

满足以上原则, 这棵树就是一个 `红黑树`。

但是 红黑树 是一个较为平衡的二叉搜索树, 只满足这些条件能够保证 `最长路径 不大于 最短路径的两倍` 吗？

答案 当然是可以的

> `只要满足这些条件, 则 树的最长路径 就不会大于 最短路径的二倍`
>
> 为什么？
>
> 1. 树中不能存在连续的 `红` 节点, 即 树中最长的路径一定是 黑-`红`-黑-`红`-黑-`红`······ 一黑一`红` 的情况
> 2. 树中最短的路径, 一定是全 黑 节点
> 3. 每条路径的 黑 节点数目相同, 最长路径一定是 黑`红`相间的路径, 最短的路径一定是 全黑路径
>
> 所以 最长路径 最长也只是 最短路径的二倍
>
> 因为 黑红相间 和 全黑 路径的 黑 节点数目相等

所以 只要满足 `红黑树` 的条件, 就可以达到一定的平衡

---

`红黑树` 的平衡没有 `AVL树` 那么严格, 也就意味着 `红黑树`调节平衡的消耗 要比 `AVL树` 调节平衡的消耗 小得多

## 2. 红黑树的节点

红黑树结构的特点就是节点具有红色和黑色两种颜色, 所以红黑树的节点需要有两种颜色变量: 

```cpp
// 枚举常量, 表示 红 黑
enum Color {
    RED,
    BLACK
};

template<class T1>
struct RBTreeNode {
    // RedBlackTreeNode 红黑树节点
    RBTreeNode(const T1& data = T1()) 
        : _pLeft(nullptr), _pRight(nullptr), _pParent(nullptr)
        , _data(data)
        , _color(RED) 	// 新节点默认为红节点 
    {}
    
    RBTreeNode<T1>* _pLeft;			// 节点左孩子
    RBTreeNode<T1>* _pRight;		// 节点右孩子
    RBTreeNode<T1>* _pParent;		// 节点父亲节点
    
    T1 _data;					     // 节点数据
    Color _color;					// 节点颜色
};
```

> 问题: 为什么 红黑树的新节点默认设置为 `红`节点?
>
> ​	因为 插入的新节点是 `红`节点时, 对 `红`黑树结构的影响 更小
>
> ​	举个例子: 
>   1. 插入的新节点是 `红`节点: 
>
>      a. 可能新节点的父亲节点是黑节点, 则插入新节点不会破坏红黑树结构, 红黑树就不需要调整
>
>      b. 可能新节点的父亲节点是红节点, 则插入新节点会破坏红黑树的结构, 因为红黑树不允许存在连续的红节点, 就需要调整红黑树的结构
>
>   2. 插入的新节点是 黑节点: 
>
>      如果新节点是 黑节点, 就不需要考虑父亲节点是什么颜色的
>
>      但是, 新节点是黑节点 `势必会破坏红黑树的结构` , 因为 `红黑树每条路径的黑节点数目是相等的` , 如果新插入一个黑节点 , 则会`导致所在路径的黑节点数目与其他所有路径的黑节点数目不同`, 整棵树的结构都被破坏了, 并且`更难调整`.
>
>      所以 红黑树节点默认设置为 `红`节点

## 3. 红黑树的结构

`红`黑树的结构就是普通二叉树的结构: 

```cpp
template<class T1>
class RBTree {
    typedef RBTreeNode<T1> Node;			// 对节点类型进行typedef
    
private:
    Node* _root = nullptr;
}
```

## 4. 红黑树的插入

红黑树 也是一个 二叉搜索树, 所以红黑树插入数据节点的操作, 可以大致分为两个部分: 

1. 按照二叉搜索树插入结点的操作插入节点
2. 判断树的结构, 并调整树的结构

所以 按照二叉搜索树插入结点: 

```cpp
bool insert(const T1& data) {
    if (_root == nullptr) {
       	// 树为空时, 插入新节点
        _root = new Node<data>;
        _root->_pParent = nullptr;
        
        return true;
    }
    
    // 树不为空, 就从根节点开始找位置
    Node* cur = _root;
    Node* parent = cur->_pParent;
    while(cur) {
        if (data > cur->_data) {
            // 插入数据大, 就向右子树找
            parent = cur;
            cur = cur->_pRight;
        }
        else if (data < cur->_data){
            // 插入数据小, 就向左子树找
            parent = cur;
            cur = cur->_pLeft;
        }
        else {
            // 树中已存在插入数据, 返回 false 插入失败
            return false; 
        }
    }
    // 出循环之后, cur所在位置就是 新节点需要插入的位置
    cur = new Node(data);
    cur->_color = RED;
    // parent 与 cur连接起来
    if (data > parent->_data) {
        // 数据大, 即新节点是父亲节点的右节点
        parent->_pRight = cur;
    }
    else {
        // 数据小, 即新节点是父亲节点的左节点
        parent->_pLeft = cur;
    }
    cur->_pParent = parent;
}
```

上面就是 按照二叉搜索树插入结点 的操作

第一步完成之后, 就需要进行第二步, 第二步则需要具体情况具体分析: 

> ### `新节点父亲节点是黑节点`
>
> 如果新节点的父亲节点是黑节点, 那么`红`黑树的结构是没有被破坏的, 所以是不需要调整`红`黑树的结构的

> ### `新节点父亲节点是红节点`
>
> 如果新节点的父亲节点是`红`节点, 那么 此时 违反了 `红`黑树中不能存在连续的`红`节点 的规则, 所以需要进行调整
>
> 在分情况分析之前, 为了方便分析 需要约定一些内容: 
>
> <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20230410140857355.webp" alt="|wide" style="zoom:80%; display: block; margin: 0 auto;" />
>
> `cur是当前`节点, `p是父亲(parent)`节点, `g是祖父(grandfather)`节点, `u是叔叔(uncle)`节点——与父亲节点同父亲节节点
>
> `a、b、c、d、e` 是 5 个红黑子树
>
> > `此树可能只是一个子树`
>
> 那么就可以根据约定图, 分出具体情况: 
>
> > #### `情况一: 叔叔节点存在, 且叔叔节点为 红节点`
> >
> > 即类似这种情况: 
> >
> > <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20230410140903636.webp" alt="|wide" style="zoom:80%; display: block; margin: 0 auto;" />
> >
> > 这种情况的处理方法很简单, 就是将 p 和 u 节点颜色改为 黑色, 再将 g 节点改为`红`色
> >
> > 即改为这样: 
> >
> > <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20230410140920046.webp" alt="|wide" style="zoom:80%; display: block; margin: 0 auto;" />
> >
> > > 问题: 为什么 g 节点需要改为 `红`色？
> > >
> > > ​	因为当 p 和 u 节点改为黑色之后, 经过这两个节点的路径上的黑色节点数目会 +1, 会导致与其他路径上的黑色节点数目不同, 进而导致红黑树结构被破坏
> > >
> > > ​	所以 需要将 p 和 u 节点的颜色由 黑色改为`红`色, 进而调整路径上黑色节点的数目
> >
> > 不过, 修改 g 节点为 `红`色之后, 可能会出现 g节点和g 父亲节点同为`红`节点的情况, 即: 
> >
> > <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20230410140956510.webp" alt="|wide" style="zoom:80%; display: block; margin: 0 auto;" />
> >
> > 所以 需要将 g节点作为新的cur节点, 进而衍生出新的 p、u、g节点, 继续进行情况判断及调整
> >
> > > 所以 cur节点 可能是从新插入节点 向上更新出来的
> >
> > `另外 需要考虑两种不同的情况—— p节点是g节点的左孩子, p节点是g节点的右孩子。 因为这两种不同的情况, u节点的位置也不一样, 所以需要分开考虑`
> >
> > 所以 此种情况——`叔叔节点存在, 且叔叔节点为 红节点`, 的对应代码可以为: 
> >
> > ```cpp
> > // 上面插入新节点时 已经记录了 cur 和 parent节点
> > while (parent && parent->_color == RED) {
> >     // 父亲节点存在, 且父亲节点也为红色时
> >     Node* grandFa = parent->_pParent; 			// 记录祖先节点
> >     if (parent == grandFa->_pLeft) {
> >         // 父亲节点是祖先节点的左孩子
> >         Node* uncle = grandFa->_pRight;			// 记录叔叔节点
> >         if (uncle && uncle->_color == RED) {
> >             // 叔叔节点存在 且是红节点
> >             parent->_color = uncle->_color = BLACK;			// 父亲节点 和 叔叔节点改为黑色
> >             grandFa->_color = RED;						 // 祖父节点 改为红色
> > 
> >             cur = grandFa;								// 更新 grandFa节点为新的cur节点
> >             parent = cur->_pParent;						  // 更新 新的parent节点
> >         }
> >     }
> >     else {
> >         // 父亲节点是祖先节点的右孩子
> >         Node* uncle = grandFa->_pLeft;			// 记录叔叔节点
> >         if (uncle && uncle->_color == RED) {
> >             parent->_color = uncle->_color = BLACK;
> >             grandFa->_color = RED;
> > 
> >             cur = grandFa;
> >             parent = cur->_pParent;
> >         }
> >     }
> > }
> > ```
>
> ---
>
> > #### `情况二: 叔叔节点不存在 或 叔叔节点存在且为黑`
> >
> > 此种情况的树 结构可能是这样的: 
> >
> > ![|wide](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020205123688.webp)
> >
> > 也可能是这样的: 
> >
> > ![|wide](https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020211843501.webp)
> >
> > 这也是两种不同的情况, 处理的方法也是不一样的: 
> >
> > > 对于情况二的 `第一种情况`——`g、p、cur节点在一条直线上`(p节点是g节点的左孩子, 且cur节点是p节点的左孩子):
> > >
> > > u节点 也有两种情况, u节点 的情况不同 就表示形成此情况的过程不同: 
> > >
> > > 1. u 为空时, cur节点 `一定是新插入的节点`, 并不是新插入节点向上更新出现的
> > >
> > >     所以, u 为空时, 插入新节点之后结构图应该是这样的: 
> > >
> > >     <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020220018805.webp" alt="|inline" style="zoom:80%; display: block; margin: 0 auto;" />
> > >
> > >     即 cur 没有左右子树
> > >
> > >     没有插入新节点的时候, 结构图应该是这样的: 
> > >
> > >     <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020215706957.webp" alt="|inline" style="zoom:80%; display: block; margin: 0 auto;" />
> > >
> > >     为什么呢？
> > >
> > >     因为 u节点不存在, 就说明 `g节点的右孩子 不存在黑色节点`。如果 p节点原本就存在左右孩子, 那么左右孩子一定是黑色的(因为p节点是红色的), 此时 `红`黑树就不满足规则, 所以 u节点不存在, p节点的左右孩子就也不存在
> > >
> > >     所以, `cur 一定就是新插入的节点`, 而不是更新出来的
> > >
> > > 2. u 存在且为黑时, cur节点一定是从 第一种大情况更新出来的
> > >
> > >     所以 新节点插入 并 更新之后 此时的结构图就应该是这样: 
> > >
> > >     <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020221431465.webp" alt="|inline" style="zoom:80%; display: block; margin: 0 auto;" />
> > >
> > >     新节点插入之前, 应该是这样的: 
> > >
> > >     <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020221555981.webp" alt="|inline" style="zoom:80%; display: block; margin: 0 auto;" />
> > >
> > >     为什么？
> > >
> > >     因为, 当 u节点 存在且为黑色时, 就表示 g节点的右子树中至少有一个黑节点, 那么 原本cur所在的位置必须是黑节点, 才能保证 新节点插入之前此树是一个满足规则的`红`黑树
> > >
> > >     所以 当 u节点 存在且为黑色时, 此种情况 的`cur节点 一定是由第一种大情况更新出来的, 即 cur节点不是新插入的节点`
> > >     
> > >     不过 对于这两种情况: <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020220018805.webp" alt="image-20221020220018805" style="zoom:80%;" /> <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020221431465.webp" alt="image-20221020221431465" style="zoom: 57%;" /> 
> > >     
> > >     都可以用 同一种方法解决, 即 以 `p节点为右单旋的parent, 进行右单旋`: 
> > >     
> > >     <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020231648658.webp" alt="image-20221020231648658" style="zoom:80%;" /> 然后变色 `——>` <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020231727070.webp" alt="image-20221020231727070" style="zoom:80%;" /> 
> > >     
> > >     <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020223207761.webp" alt="image-20221020223207761" style="zoom: 53%;" />然后变色 `——>` <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020223358710.webp" alt="image-20221020223358710" style="zoom:55%;" />
> > >     
> > >     > 如果 对于旋转操作不理解或者不熟悉, 可以阅读博主另一篇关于AVL树分析的文章
> > >     >
> > >     > 其中详细介绍了 平衡二叉树旋转的操作
> > >
> > > ---
> > >
> > > 对于情况二的 `第二种情况`——`g、p、cur节点在一条折线上`(p节点是g节点的左孩子, cur节点是p节点的右孩子):
> > >
> > > 与上面一样, u 也存在两种情况: 
> > >
> > > 1. u 不存在, 则插入新节点 前 后 的结构图应该是这样的
> > >
> > >     <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020232311761.webp" alt="image-20221020232311761" style="zoom:59%;" /> 和 <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020232353404.webp" alt="image-20221020232353404" style="zoom:59%;" />
> > >
> > > 2. 当 u 存在, 且为黑节点时, 插入新节点 前 后 的结构图应该是这样的；
> > >
> > >     <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020232635692.webp" alt="image-20221020232635692" style="zoom: 65%;" /> 和 <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020232702689.webp" alt="image-20221020232702689" style="zoom: 65%;" />
> > >
> > >     那么 对于这种情况, 也可以使用同一种方法解决, 即: 
> > >
> > >     先 `将 p节点 作为左单旋的parent, 做左单旋, 将 折线的情况 转换 为直线的情况`: 
> > >
> > >     ​	<img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020234113447.webp" alt="image-20221020234113447" style="zoom:80%;" />  <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020233802531.webp" alt="image-20221020233802531" style="zoom:70%;" />
> > >
> > >     然后再 `将 cur节点作为 右单旋的parent, 做右单旋, 将直线的情况解决`: 
> > >
> > >     <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020234641936.webp" alt="image-20221020234641936" style="zoom:80%;" /> 然后变色 `——>` <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020234718531.webp" alt="image-20221020234718531" style="zoom:80%;" />
> > >
> > >     <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020234936694.webp" alt="image-20221020234936694" style="zoom: 55%;" /> 然后变色 `——>` <img src="https://dxyt-july-image.oss-cn-beijing.aliyuncs.com/image-20221020235017875.webp" alt="image-20221020235017875" style="zoom:55%;" />
> > >
> > >     即, 对于此种情况 需要使用 `左右双旋`解决

<div id="pcMode" class="hidden"></div>
